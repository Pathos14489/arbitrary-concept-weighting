import { load } from './index.js';
import fs from 'fs';

async function main() {
    var modelName = 'hamilton' // What is the name of the model directory in your models directory?

    console.log(`Loading ${modelName}...`);
    var start = Date.now();
    var model = await load(modelName);
    var end = Date.now();
    console.log(`Loaded`,model.totalWords,`Word Model in`, (end - start) / 1000, "seconds");

    function test(string) {
        console.log(string+"(simple)",model.getSimpleWeight(string));
        console.log(string+"(synonyms)",model.getSynonymWeight(string));
        console.log(string+"(antonyms)",model.getAntonymWeight(string));
        console.log(string+"(complex)[simple+synonyms+antonyms]",model.getComplexWeight(string));
    }
    
    console.log("Getting test weights...");
    var startWeights = Date.now();

    test("I only want the best for you.")
    test("I hope you die.")

    var endWeights = Date.now();
    console.log("Got test weights in", (endWeights - startWeights) / 1000, "seconds");
}
main();