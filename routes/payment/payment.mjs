import { Router } from 'express';
import Axios   from 'axios';
import FileSys from 'fs';
import Hash    from 'hash.js';
import Moment  from 'moment';

import { nets_api_key, nets_api_skey, nets_api_gateway } from './payment-config.mjs';
import { Reservations } 	from '../../data/models/Reservations.mjs';

const router = Router();
export default router;

router.post("/generate", nets_generate);
router.post("/query",    nets_query);
router.post("/void",     nets_void);

router.post("/deposit",  create_reservation);

let   nets_stan     = 0;	//	Counter id for nets, keep this in database

/**
 * Draws the example page that will create the QR Code
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */

/**
 * Signs the payload with the secret key
 * @param {{}} payload 
 * @returns {string} Signature
 */

function generate_signature(payload) {
	// 1. signature = json + secret (Concatenate payload and secret)
	const content = JSON.stringify(payload) + nets_api_skey;
	// 2. signature = sha265(signature)SHA-256 Hash 
	// 3. signature = uppercase(signature)Convert to Uppercase 
	const hash    = Hash.sha256().update(content).digest('hex').toUpperCase();
	// 4. signature = base64encode(signature)Base64 encode
	return (Buffer.from(hash, 'hex').toString('base64'));
}

/**
 * Generates a NETs QR code to be scanned. With specified price in CENTS
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
async function nets_generate(req, res) {
	try {
		if (!req.body.amount)
			throw Error("missing required parameter `amount`");
	}
	catch (error) {
		console.error(`Bad request`);
		console.error(error);
		return res.sendStatus(400);
	}

	//	1. Load the constant JSON request 

	try {
		const amount   = parseInt(req.body.amount);	//	Assume in cents
		const datetime = new Date();				//	Current date and time

		const payload  = JSON.parse(FileSys.readFileSync(`${process.cwd()}/res/nets/nets-qr-request.json`));
		const stan     = ++nets_stan;
		
		//	Ensures that nets_stat is between 0 ~ 999999
		if (nets_stan >= 1000000)
			nets_stan = 0;

		//console.log(payload);

		//	Just update these stuff
		payload.stan             = stan.toString().padStart(6, '0');
		payload.amount           = amount;
		payload.npx_data.E201    = amount;

		payload.transaction_date = Moment(datetime).format("MMDD");
		//`${datetime.getMonth().toString().padStart(2, '0')}${datetime.getDay().toString().padStart(2, '0')}`;
		payload.transaction_time = Moment(datetime).format("HHmmss");
		//datetime.toTimeString().split(' ')[0].replace(':', '').replace(':', '');

		//	Sign the payload
		const signature = generate_signature(payload);

		const response = await Axios.post(nets_api_gateway.request, payload, {
			headers: {
				"Content-Type": "application/json",
				"KeyId":        nets_api_key,
				"Sign":         signature
			}
		});

		if (response.status != 200)
			throw new Error("Failed request to NETs");

		if (response.data.response_code != '00') {
			throw new Error("Failed to request for QR Code");
		}

		console.log(response.data);
		return res.json({
			"txn_identifier":   response.data.txn_identifier,
			"amount":           response.data.amount,
			"stan":             response.data.stan,
			"transaction_date": response.data.transaction_date,
			"transaction_time": response.data.transaction_time,
			"qr_code":          response.data.qr_code
		});
	}
	catch (error) {
		console.error(`Failed to generate QR code for payment`);
		console.error(error);
		return res.sendStatus(500);
	}
}

/**
 * Query a created transaction status. Whether its completed or in progress or cancelled
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */


// ----------------
// Check user role
function getRole(role) {
	if (role == 'admin') {
		var admin = true;
		var business = false;
		var customer = false;
	}
	else if (role == 'business') {
		var admin = false;
		var business = true;
		var customer = false;
	}
	else if (role == 'customer') {
		var admin = false;
		var business = false;
		var customer = true;
	}
	return [admin, business, customer];
}

async function create_reservation(req,res) {
	var role = getRole(req.user.role);
	var admin = role[0];
	var business = role[1];
	var customer = role[2];

	const reservation = await Reservations.create({
		"reservation_id": req.body.Id,
		"name":  req.body.BusinessName,
		"location":  req.body.Location,
		"date": req.body.ResDate,
		"pax": req.body.Pax,
		"time": req.body.Time[0],
		"discount": req.body.Discount,
		"user_name": req.body.Name,
		"user_email": req.body.Email,
		"user_contact": req.body.Contact,
	});
	return res.render("success", {
		admin:admin,
		business:business,
		customer:customer,
		reservation:reservation
	});
}

async function nets_query(req, res) {
	try {

	}
	catch (error) {
		console.error(`Bad request`);
		console.error(error);
		return res.sendStatus(400);
	}

	try {
		const payload  = JSON.parse(FileSys.readFileSync(`${process.cwd()}/res/nets/nets-qr-query.json`));
		
		payload.txn_identifier   = req.body.txn_identifier;
		payload.stan             = req.body.stan;
		payload.transaction_date = req.body.transaction_date;
		payload.transaction_time = req.body.transaction_time;
		payload.npx_data.E201    = req.body.amount;
		
		const signature = generate_signature(payload);
		const response  = await Axios.post(nets_api_gateway.query, payload, {
			headers: {
				"Content-Type": "application/json",
				"KeyId":        nets_api_key,
				"Sign":         signature
			}
		});

		if (response.status != 200) 
			throw new Error(`Failed to query transaction: ${payload.txn_identifier}`);
		
		switch (response.data.response_code) {
			//	Pending
			case "09":
				return res.json({
					status : 0
				});

			//	Okay
			case "00":
				create_reservation()
				return res.json({
					status : 1
				});

			//	Failed
			default:
				return res.json({
					status : -1
				});
		}
	}
	catch (error) {
		console.error(`Failed to query transaction`);
		console.error(error);
		return res.sendStatus(500);
	}
}

/**
 * Cancel a specified transaction
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 */
async function nets_void(req, res) {
	try {

	}
	catch (error) {
		console.error(`Bad request`);
		console.error(error);
		return res.sendStatus(400);
	}

	try {
		const payload  = JSON.parse(FileSys.readFileSync(`${process.cwd()}/res/nets/nets-qr-void.json`));
		
		payload.txn_identifier   = req.body.txn_identifier;
		payload.stan             = req.body.stan;
		payload.transaction_date = req.body.transaction_date;
		payload.transaction_time = req.body.transaction_time;
		payload.amount           = req.body.amount;
		// payload.npx_data.E201    = req.body.amount;
		
		const signature = generate_signature(payload);
		const response  = await Axios.post(nets_api_gateway.void, payload, {
			headers: {
				"Content-Type": "application/json",
				"KeyId":        nets_api_key,
				"Sign":         signature
			}
		});

		if (response.status != 200) 
			throw new Error(`Failed to query transaction: ${payload.txn_identifier}`);
		
		console.log(response.data);

		switch (response.data.response_code) {
			//	Okay
			case "00":
				return res.json({
					status : 1
				});
			case "68":
				return res.json({
					status : 0
				});
			//	Skip?
			default:
				return res.json({
					status : -1
				});
		}
	}
	catch (error) {
		console.error(`Failed to void transaction`);
		console.error(error);
		return res.sendStatus(500);
	}
}
