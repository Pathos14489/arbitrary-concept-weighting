import express from 'express';
import {load} from "./index.js"

var app = express();
async function main() {
    var model = await load("hamilton")
    console.log("Model loaded");
    app.use(express.json());
    app.use(express.urlencoded({extended: true}));
    app.post('/', async (req, res) => {
        var text = req.body.text;
        var types = req.body.types || [];
        if(typeof types === "string") types = types.split(",") || [];
        else if(!Array.isArray(types)) types = [];
        console.log(`Received text:`,text);
        console.log(`Received types:`,types);
        console.log(`getting weights...`);
        var weights = model.get(text,types)
        console.log("got weights");
        res.send(weights);
    });
    app.listen(3009, () => console.log('listening @ http://localhost:3009/'));
}
main();