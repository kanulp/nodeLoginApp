const mongoose = require("mongoose");

const MONGOURI = "mongodb+srv://username:pass@cluster0.3ysot.mongodb.net/<dbname>?retryWrites=true&w=majority";

const InitiateMongoServer = async() => {
    try {
        await mongoose.connect(MONGOURI, {
            useNewUrlParser: true
        });
        console.log("Connected to DB !!");
    } catch (e) {
        console.log(e);
        throw e;
    }
};

module.exports = InitiateMongoServer;


// const MongoClient = require('mongodb').MongoClient;
// const uri = "mongodb+srv://karan_gajjar:<password>@cluster0.3ysot.mongodb.net/<dbname>?retryWrites=true&w=majority";
// const client = new MongoClient(uri, { useNewUrlParser: true });
// client.connect(err => {
//     const collection = client.db("test").collection("devices");
//     // perform actions on the collection object
//     client.close();
// });