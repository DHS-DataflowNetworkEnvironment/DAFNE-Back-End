const router = require('express').Router();
const controller = require('app/controllers/ingesters');
const isAuth = require('app/auth/is-auth');
const isAdmin = require('app/auth/is-admin');

/** CRUD OPERATIONS */
//GET Initial Service Data -> [GET] ../service-data
router.get('/service-data', isAuth, controller.getServiceDataForIngesters);

//GET ALL Datastores -> [GET] ../datastores
router.get('/datastores', isAuth, controller.getAllDatastores);

//GET ALL Metadatastores -> [GET] ../metadatastores
router.get('/metadatastores', isAuth, controller.getAllMetadatastores);

//GET ALL Credentials -> [GET] ../credentials
router.get('/credentials', isAuth, controller.getAllCredentials);

//GET ALL Producers -> [GET] ../producers
router.get('/producers', isAuth, controller.getAllProducers);

//GET ALL Producers EXT -> [GET] ../producers-ext
router.get('/producers-ext', isAuth, controller.getAllProducersExt);

//GET ALL Consumers -> [GET] ../consumers
router.get('/consumers', isAuth, controller.getAllConsumers);

//GET Datastores Types list -> [GET] ../datastores-types
router.get('/datastores-types', isAuth, controller.getDatastoresTypes);

//GET ALL Ingesters -> [GET] ../get-all-ingesters
router.get('/get-all-ingesters', isAuth, controller.getAllIngesters);

//GET ALL Evictions -> [GET] ../evictions
router.get('/evictions', isAuth, controller.getAllEvictions);


//CREATE Datastore -> [POST] ../create-datastore
router.post('/create-datastore', isAuth, controller.createDatastore);

//CREATE Metadatastore -> [POST] ../create-metadatastore
router.post('/create-metadatastore', isAuth, controller.createMetadatastore);

//CREATE Producer -> [POST] ../create-producer
router.post('/create-producer', isAuth, controller.createProducer);

//CREATE Consumer -> [POST] ../create-consumer
router.post('/create-consumer', isAuth, controller.createConsumer);

//CREATE Credentials -> [POST] ../create-credentials
router.post('/create-credentials', isAuth, controller.createCredentials);


//DELETE Datastore -> [POST] ../delete-datastore
router.post('/delete-datastore', isAuth, controller.deleteDatastore);

//DELETE Metadatastore -> [POST] ../delete-metadatastore
router.post('/delete-metadatastore', isAuth, controller.deleteMetadatastore);

//DELETE Producer -> [POST] ../delete-producer
router.post('/delete-producer', isAuth, controller.deleteProducer);

//DELETE Consumer -> [POST] ../delete-consumer
router.post('/delete-consumer', isAuth, controller.deleteConsumer);

//DELETE Credentials -> [POST] ../delete-credentials
router.post('/delete-credentials', isAuth, controller.deleteCredentials);


//PATCH Datastore -> [PATCH] ../patch-datastore
router.patch('/patch-datastore', isAuth, controller.patchDatastore);

//PATCH Metadatastore -> [PATCH] ../patch-metadatastore
router.patch('/patch-metadatastore', isAuth, controller.patchMetadatastore);

//PATCH Producer -> [PATCH] ../patch-producer
router.patch('/patch-producer', isAuth, controller.patchProducer);

//PATCH Consumer -> [PATCH] ../patch-consumer
router.patch('/patch-consumer', isAuth, controller.patchConsumer);

//PATCH Credentials -> [PATCH] ../patch-credential
router.patch('/patch-credential', isAuth, controller.patchCredential);


//START & STOP Ingester -> [POST] ../ingesters-management
router.post('/ingesters-management', isAuth, controller.manageIngester);

module.exports = router;
