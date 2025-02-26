import { Router }                           from 'express';
import { flashMessage }                     from '../utils/flashmsg.mjs';

import { User, UserRole }                   from '../data/models/Users.mjs'
import { DiscountSlot }                     from '../data/models/DiscountSlot.mjs';
import { Outlets }                          from '../data/models/Outlets.mjs';
import { Reservations } 	                from '../data/models/Reservations.mjs';
import { Categories }                       from '../data/models/Categories.mjs';

import { UploadFile, DeleteFilePath }       from '../utils/multer.mjs';

import ORM                                  from 'sequelize';
const { Op } = ORM;

const router = Router();
export default router;

// ---------------- 
// Business User routing

// Business User profile
router.get("/b/:name",                                  user_business_page);
router.get("/b/edit/:name",                             edit_user_business_page);
router.put("/b/saveUser/:name",                         save_edit_user_business);
router.get("/b/delete/:user_email",                     delete_business_user);

// Discount Slot
router.get("/b/:name/create-discount-slot",             create_discount_slot_page);
router.post("/b/:name/create-discount-slot",            create_discount_slot_process);
router.get("/b/:name/view-discount-slots",              view_discount_slots_page);
router.get("/b/:name/discounts-data",                   discounts_data);
router.get("/b/:name/edit-discount-slot/:uuid",         edit_discount_slot_page);
router.put("/b/:name/saveDiscountSlot/:uuid",           save_edit_discount_slot);
router.get("/b/:name/delete-discount-slot/:uuid",       delete_discount_slot);

// Outlets
router.get("/b/:name/create-outlet",                    create_outlet_page);
router.post("/b/:name/create-outlet",                   UploadFile.single("Thumbnail"), create_outlet_process);
router.get("/b/:name/view-outlets",                     view_outlets_page);
router.get("/b/:name/outlets-data",                     outlets_data);
router.get("/b/:name/edit-outlet/:postal_code",         edit_outlet_page);
router.put("/b/:name/saveOutlet/:postal_code",          UploadFile.any("Thumbnail"), save_edit_outlet);
router.get("/b/:name/delete-outlet/:postal_code",       delete_outlet);

// Reservations
router.get("/b/:name/select-outlet",                    view_select_outlet_page);
router.get("/b/:name/:location/reservation-status",     view_reservation_status_page);

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
// ----------------

// ---------------- 
// Profile settings

function user_business_page(req, res) {
    var role = getRole(req.user.role);
    var admin = role[0];
    var business = role[1];
    var customer = role[2];

	return res.render('user/business/userBusiness', {
        admin: admin,
        business: business,
        customer: customer
    });
};

function edit_user_business_page(req, res) {
    const user = User.findOne({
        where: {
            "name": req.params.name
        }
    }).then((user) => {
        var role = getRole(req.user.role);
        var admin = role[0];
        var business = role[1];
        var customer = role[2];
        res.render('user/business/update_userBusiness', {
            user,
            admin: admin,
            business: business,
            customer: customer
        });
    }).catch(err => console.log(err));
};

function save_edit_user_business(req, res) {
    let { Name, Email, Contact } = req.body;
    const user = User.findOne({
        where: {
            role: UserRole.Business,
            name: req.params.name
        }
    });

    User.update({
        name: Name,
        email: Email,
        contact: Contact
    }, { where: {role: UserRole.Business, name: req.params.name}}
    ), 
    Outlets.update({
        name: Name
    }, { where: {name: req.params.name}}
    ),
    DiscountSlot.update({
        name: Name
    }, { where: {name: req.params.name}}
    ),
    Reservations.update({
        name: Name
    }, { where: {name: req.params.name}} 
    ).then(() => {
        console.log(`user name saved as ${Name}`);
        res.redirect(`/u/b/${Name}`);
    }).catch(err => console.log(err));  
};

function delete_business_user(req, res) {
    const user = User.findOne({
        where: {
            email : req.params.user_email
        },
    }).then((user) => {
        if (user != null) {
            User.destroy({
                where: {"email" : req.params.user_email}
            }),
            Outlets.destroy({
                where: {"name": user.name}
            }),
            DiscountSlot.destroy({
                where: {"name": user.name}
            }),
            Reservations.destroy({
                where: {"name": user.name}
            }).then(() => {
                flashMessage(res,'success', 'Business account deleted', 'fa fa-trash', true );
                req.logout();
	            return res.redirect("/home"); 
            }).catch( err => console.log(err));
        } else {
	    res.redirect('/404');
    }
    });
};

// ---------------- 
// Discount slots

async function create_discount_slot_page(req, res) {
    const outlet = await Outlets.findAll({
        where: {
            "name": {[Op.eq]: req.params.name}
        }
    });
    const user = User.findOne({
        where: {"name": req.params.name}
    });
    var role = getRole(req.user.role);
    var admin = role[0];
    var business = role[1];
    var customer = role[2];
    return res.render('user/business/create_discountslot', {
        admin: admin,
        business: business,
        customer: customer,
        outlet: outlet
    });
};

async function create_discount_slot_process(req, res) {
    let { Name, Location, Time, Discount, GlobalCreate } = req.body;

    if ( GlobalCreate == "True" ) {
        const restaurants = await Outlets.findAll({
            where: { "name": Name }
        });
        const count_restaurants = await Outlets.count({
            where: { "name": Name }
        });
        for (let i = 0; i < count_restaurants; i++ ) {
            const discountslot = await DiscountSlot.create({
                "name":  Name,
                "location":  restaurants[i].location,
                "time": Time,
                "discount": Discount
            });
        }
    } else {
        const discountslot = await DiscountSlot.create({
        "name":  Name,
        "location":  Location,
        "time": Time,
        "discount": Discount
    })};
    res.redirect(`/u/b/${Name}/view-discount-slots`);
};

async function view_discount_slots_page(req, res) {
        var role = getRole(req.user.role);
        var admin = role[0];
        var business = role[1];
        var customer = role[2];
        
        return res.render('user/business/retrieve_discountslots', {
            admin: admin,
            business: business,
            customer: customer
        });
    };

    /**
* Provides bootstrap table with data
* @param {import('express')Request}  req Express Request handle
* @param {import('express')Response} res Express Response handle
*/
async function discounts_data(req, res) {
    try {
        console.log('finding discount data');
        let pageSize = parseInt(req.query.limit);
        let offset = parseInt(req.query.offset);
        let sortBy = req.query.sort ? req.query.sort : "dateCreated";
        let sortOrder = req.query.order ? req.query.order : "desc";
        let search = req.query.search;
        if (pageSize < 0) {
            throw new HttpError(400, "Invalid page size");
        }
        if (offset < 0) {
            throw new HttpError(400, "Invalid offset index");
        }
        
        /** @type {import('sequelize/types').WhereOptions} */
        const conditions = {name : req.user.name}
        search
        ? {
            [Op.or]: {
                location: { [Op.substring]: search},
                time: { [Op.substring]: search},
                discount: { [Op.substring]: search}
            }
        }
        : undefined;
        const total = await DiscountSlot.count({ where: conditions });
        const pageTotal = Math.ceil(total / pageSize);
 
        const pageContents = await DiscountSlot.findAll({
            offset: offset,
            limit: pageSize,
            order: [[sortBy, sortOrder.toUpperCase()]],
            where: conditions,
            raw: true,
        });
        return res.json({
            total: total,
            rows: pageContents,
        });
    } catch (error) {
        console.error("Failed to retrieve all Discounts");
        console.error(error);
        return res.status(500).end();
    }
 }

async function edit_discount_slot_page(req, res){
    const outlet = await Outlets.findAll({
        where: {
            "name": {
                [Op.eq]: req.params.name
            }
        }
    });
    const user = User.findOne({
        where: {
            "name": req.params.name
        }
    })
    var role = getRole(req.user.role);
    var admin = role[0];
    var business = role[1];
    var customer = role[2];

    const discount_slot = await DiscountSlot.findOne({
        where: {
            "name" : req.params.name,
            "uuid": req.params.uuid
        }
    }).then((discount_slot) => {
        res.render(`user/business/update_discountslot`, {
            discount_slot: discount_slot,
            admin: admin,
            business: business,
            customer: customer,
            outlet: outlet
        });
    }).catch(err => console.log(err));
};

function save_edit_discount_slot(req, res){
    let { Name, Location, Time, Discount } = req.body;

    DiscountSlot.update({
        name: Name,
        location:  Location,
        time: Time,
        discount: Discount
    }, {
        where: {
            uuid : req.params.uuid
        }
        }).then(() => {
            res.redirect(`/u/b/${Name}/view-discount-slots`);
    }).catch(err => console.log(err)); 
};

function delete_discount_slot(req, res) {
    DiscountSlot.findOne({
        where: {
            "name" : req.params.name,
            "uuid" : req.params.uuid
        },
    }).then((discount_slot) => {
        if (discount_slot != null) {
            DiscountSlot.destroy({
                where: {
                    "name" : req.params.name,
                    "uuid" : req.params.uuid
                }
            }).then(() => {
                res.redirect(`/u/b/${req.params.name}/view-discount-slots`);
            }).catch( err => console.log(err));
        } else {
	    res.redirect('/404');
    }
    });
};

// ---------------- 
// Outlets, Reservation Status
async function create_outlet_page(req, res) {
    const category = await Categories.findAll();
    const user = User.findOne({
        where: {
            "name": req.params.name
        }
    })
    var role = getRole(req.user.role);
    var admin = role[0];
    var business = role[1];
    var customer = role[2];
	return res.render('user/business/create_outlet', {
        admin: admin,
        business: business,
        customer: customer,
        category: category
    });
};

async function create_outlet_process(req, res) {
    let errors = [];
    
    let { Name, Category, Location, Address, Postalcode, Price, Contact, Description } = req.body;
    console.log(`${req.file.path}`)

    const outlet = await Outlets.create({
        "name":  Name,
        "category" : Category,
        "location":  Location,
        "address":  Address,
        "postal_code":  Postalcode,
        "price":  Price,
        "contact":  Contact,
        "description": Description,
        "thumbnail": req.file.path
    });
    res.redirect(`/u/b/${Name}/view-outlets`);
};

async function view_outlets_page(req, res) {
    var role = getRole(req.user.role);
    var admin = role[0];
    var business = role[1];
    var customer = role[2];
    
	return res.render('user/business/retrieve_outlets', {
        admin: admin,
        business: business,
        customer: customer
    });
};

/**
* Provides bootstrap table with data
* @param {import('express')Request}  req Express Request handle
* @param {import('express')Response} res Express Response handle
*/
async function outlets_data(req, res) {
   try {
       console.log('finding data');
       let pageSize = parseInt(req.query.limit);
       let offset = parseInt(req.query.offset);
       let sortBy = req.query.sort ? req.query.sort : "dateCreated";
       let sortOrder = req.query.order ? req.query.order : "desc";
       let search = req.query.search;
       if (pageSize < 0) {
           throw new HttpError(400, "Invalid page size");
       }
       if (offset < 0) {
           throw new HttpError(400, "Invalid offset index");
       }
       
       /** @type {import('sequelize/types').WhereOptions} */
       const conditions = {name: req.user.name}
       search
       ?{
           [Op.or]: {
               location: { [Op.substring]: search},
               postal_code: { [Op.substring]: search}  
           }
       }
       : undefined;
       const total = await Outlets.count({ where: conditions });
       const pageTotal = Math.ceil(total / pageSize);

       const pageContents = await Outlets.findAll({
           offset: offset,
           limit: pageSize,
           order: [[sortBy, sortOrder.toUpperCase()]],
           where: conditions,
           raw: true,
       });
       return res.json({
           total: total,
           rows: pageContents,
       });
   } catch (error) {
       console.error("Failed to retrieve all Outlets");
       console.error(error);
       return res.status(500).end();
   }
};

async function edit_outlet_page(req, res){
    const category = await Categories.findAll();
    const user = User.findOne({
        where: {
            "name": req.params.name
        }
    });
    var role = getRole(req.user.role);
    var admin = role[0];
    var business = role[1];
    var customer = role[2];

    const outlet = Outlets.findOne({
        where: {
            "name" : req.params.name,
            "postal_code": req.params.postal_code
        }
    }).then((outlet) => {
        res.render(`user/business/update_outlet`, {
            outlet: outlet,
            admin: admin,
            business: business,
            customer: customer,
            category: category
        });
    }).catch(err => console.log(err));
};

function save_edit_outlet(req, res){
    let { Name, Category, Location, Address, Postalcode, Price, Contact, Description } = req.body;

    Outlets.update({
        name:  Name,
        category: Category,
        location:  Location,
        address:  Address,
        postal_code:  Postalcode,
        price:  Price,
        contact:  Contact,
        description: Description,
        thumbnail: req.path.file
    }, {
        where: {
            postal_code : req.params.postal_code
        }
        }).then(() => {
            res.redirect(`/u/b/${Name}/view-outlets`);
    }).catch(err => console.log(err)); 
};

// //if (req.files.length > 0) {
//     console.log(`Replaced profile image ${thumbnail} with ${req.files[0].path}`)
//     //	Delete old file
//     DeleteFilePath(`${process.cwd()}/${thumbnail}`);
//     thumbnail = req.files[0].path;
// }

function delete_outlet(req, res) {
    Outlets.findOne({
        where: {
            "name" : req.params.name,
            "postal_code" : req.params.postal_code
        },
    }).then((outlet) => {
        if (outlet!= null) {
            Outlets.destroy({
                where: {
                    "name" : req.params.name,
                    "postal_code" : req.params.postal_code
                }
            }),
            DiscountSlot.destroy({
                where: {"name": req.params.name}
            }).then(() => {
                res.redirect(`/u/b/${req.params.name}/view-outlets`);
            }).catch( err => console.log(err));
        } else {
	    res.redirect('/404');
    }
    });
};

async function view_select_outlet_page(req, res) {
    var role = getRole(req.user.role);
    var admin = role[0];
    var business = role[1];
    var customer = role[2];

    const outlet = await Outlets.findAll({
        where: {
            "name" : req.params.name,
        }
    })
	return res.render('user/business/select_outlet', {
        outlet: outlet,
        admin: admin,
        business: business,
        customer: customer
    });
};

async function view_reservation_status_page(req, res) {
    var role = getRole(req.user.role);
    var admin = role[0];
    var business = role[1];
    var customer = role[2];

    const reservation = await Reservations.findAll({
        where: {
            "name" : req.params.name,
            "location" : req.params.location
        }
    })
	return res.render('user/business/retrieve_reservationBusiness', {
        reservation: reservation,
        admin: admin,
        business: business,
        customer: customer
    });
};

// ---------------- 	
// Customer user routing

router.get("/c/:user_email",                        user_customer_page);
router.get("/c/edit/:user_email",                   edit_user_customer_page);
router.put("/c/saveUser/:user_email",               save_edit_user_customer);
router.get("/c/delete/:user_email",                 delete_customer_user);

// Customer reservation

router.post("c/create-reservation",                                                create_reservation_process);
router.get("/c/my-reservations/upcoming/:user_email",                              view_upcoming_reservations_page);
router.get("/c/my-reservations/historical/:user_email",                            view_historical_reservations_page);

router.get("/c/my-reservations/:user_email/edit-reservation/:reservation_id",      edit_reservation_page);
router.put("/c/my-reservations/:user_email/save-reservation/:reservation_id",      save_edit_reservation);
router.get("/c/my-reservations/:user_email/cancel-reservation/:reservation_id",    delete_reservation);

function user_customer_page(req, res) {
    const user = User.findOne({
        where: {
            "email": req.params.user_email
        }
    })
    var role = getRole(req.user.role);
    var admin = role[0];
    var business = role[1];
    var customer = role[2];
	return res.render('user/customer/userCustomer', {
        admin: admin,
        business: business,
        customer: customer
    });
};

function edit_user_customer_page(req, res) {
    const user = User.findOne({
        where: {
            "email": req.params.user_email
        }
    }).then((user) => {
        var role = getRole(req.user.role);
        var admin = role[0];
        var business = role[1];
        var customer = role[2];
        res.render('user/customer/update_userCustomer', {
            user,
            admin: admin,
            business: business,
            customer: customer
        });
    }).catch(err => console.log(err));
};
 
function save_edit_user_customer(req, res) {
    let { Name, Contact, Email } = req.body;

    User.update({
        name: Name,
        email: Email,
        contact: Contact
    }, { where: {email: req.params.user_email}}
    ),
    Reservations.update({
        user_name: Name,
        user_email: Email,
        contact: Contact
    }, { where: {user_email: req.params.user_email}}
    ).then(() => {
            res.redirect(`/u/c/${Email}`);
    }).catch(err => console.log(err));  
};

function delete_customer_user(req, res) {
    User.findOne({
        where: {
            "email" : req.params.user_email
        },
    }).then((user) => {
        if (user != null) {
            User.destroy({
                where: {
                    "email" : req.params.user_email
                }
            }),
            Reservations.destroy({
                where: {"user_email": req.params.user_email}
            }).then(() => {
                flashMessage(res,'success', 'Customer account deleted', 'fa fa-trash', true );
                req.logout();
	            return res.redirect("/home"); 
            }).catch( err => console.log(err));
        } else {
	    res.redirect('/404');
    }
    });
};

async function create_reservation_process(req, res) {
    let { reservation_id, name, location, user_name, user_email, user_contact, date, pax, time, discount } = req.body;

    const reservation = await Reservations.create({
        "reservation_id" : reservation_id,
        "name" : name,
        "location" : location,
        "user_name" : user_name,
        "user_email" : user_email,
        "user_contact" : user_contact,
        "date" : date,
        "pax" : pax,
        "time" : time,
        "discount" : discount
    });
    res.redirect("/retrieve_reservation/:user_email");
};

async function view_upcoming_reservations_page(req, res) {
    var time = Date.now()
	const reservation = await Reservations.findAll({
        where: {
            "user_email": {
                [Op.eq]: req.params.user_email
            },
            "date": {
                [Op.gt]: time
            }
        }
    });
    const user = User.findOne({
        where: {
            "email": req.params.user_email
        }
    })
    var role = getRole(req.user.role);
    var admin = role[0];
    var business = role[1];
    var customer = role[2];
    return res.render('user/customer/retrieve_upcomingreservationCustomer', {
        reservation: reservation,
        admin: admin,
        business: business,
        customer: customer
    });
};

async function view_historical_reservations_page(req, res) {
    var time = Date.now()
	const reservation = await Reservations.findAll({
        where: {
            "user_email": {
                [Op.eq]: req.params.user_email
            },
            "date": {
                [Op.lt]: time
            }
        }
    });
    const user = User.findOne({
        where: {
            "email": req.params.user_email
        }
    })
    var role = getRole(req.user.role);
    var admin = role[0];
    var business = role[1];
    var customer = role[2];
    return res.render('user/customer/retrieve_historicalreservationCustomer', {
        reservation: reservation,
        admin: admin,
        business: business,
        customer: customer
    });
};

async function edit_reservation_page(req, res){
    var role = getRole(req.user.role);
    var admin = role[0];
    var business = role[1];
    var customer = role[2];

    const reservation = await Reservations.findOne({
        where: {
            "user_email": req.params.user_email,
            "reservation_id": req.params.reservation_id
        }
    });

    const restaurant = await Outlets.findOne({
        where: {
            "name": reservation.name,
            "location": reservation.location
        }
    });
    
    const discountslot = await DiscountSlot.findAll({
        where: {
            "name": reservation.name,
            "location": reservation.location
        }
    });

    Reservations.findOne({
        where: {
            "user_email": req.params.user_email,
            "reservation_id": req.params.reservation_id
        }
    })
    .then((reservation) => {
        res.render('user/customer/update_reservationCustomer', {
            reservation: reservation,
            restaurant: restaurant,
            discountslot: discountslot,
            admin: admin,
            business: business,
            customer: customer 
        });
    }).catch(err => console.log(err));
};

function save_edit_reservation(req, res){
    let { BusinessName, Location, Name, ResDate, Pax, Email, Contact } = req.body;

    Reservations.update({
        name: BusinessName,
        location: Location,
        user_name: Name,
        user_email: Email,
        user_contact: Contact,
        date: ResDate,
        pax: Pax
    }, {
        where: {
            user_email: req.params.user_email,
            reservation_id: req.params.reservation_id
        }
        }).then(() => {
            res.redirect(`/u/c/my-reservations/upcoming/${req.params.user_email}`);
    }).catch(err => console.log(err)); 
};

function delete_reservation(req, res) {
    Reservations.findOne({
        where: {
            "user_email": req.params.user_email,
            "reservation_id": req.params.reservation_id
        },
    }).then((reservation) => {
        if (reservation!= null) {
            Reservations.destroy({
                where: {
                    "user_email": req.params.user_email,
                    "reservation_id": req.params.reservation_id
                },
            }).then(() => {
                res.redirect(`/u/c/my-reservations/upcoming/${req.params.user_email}`);
            }).catch( err => console.log(err));
        } else {
	    res.redirect('/404');
    }
    });
};