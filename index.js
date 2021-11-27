import fs from "fs"
import path from "path"
import synonyms from "synonyms"
import dictionary from "../dictionary/index.js"
import topEngWords from "./topEngWords.js"
const diff = (a, b) => {
    return Math.abs(a - b);
}

export class Weight {
    Class = null
    word = ""
    count = 0
    constructor(Class,word,count) {
        this.Class = Class
        this.word = word
        this.count = count
    }
    get weight() {
        if(this.Class.name.startsWith("-")) return -(this.count / this.Class.totalWords)
        else return this.count / this.Class.totalWords
    }
    get synonymWeight() {
        var weights = this.getSynonymWeights()
        var sum = weights.map(w=>w.score).reduce((a, b) => {
            return a + b
        }, 0)
        // console.log(`${this.word} has ${weights.length} synonyms`, weights,sum,sum / weights.length)
        return sum // weights.length
    }
    get antonymWeight(){
        var weights = this.getAntonymWeights()
        var sum = weights.map(w=>w.score).reduce((a, b) => {
            return a + b
        }, 0)
        return sum
    }
    get complexWeight(){
        var wgt = this.weight
        var syn = this.synonymWeight
        var ant = this.antonymWeight
        return (syn + ant + wgt) / 3
    }
    get synonyms(){
        // console.log(`Getting synonyms for ${this.word}`)
        var word = [this.word]
        var syns = synonyms(this.word)
        // var variations = new spellingVariations(this.word).analyze(); 
        if(syns) {
            if(syns.n) word.push(...syns.n)
            if(syns.v) word.push(...syns.v)            
        }
        // if(variations) {
        //     if(variations.variations) word.push(...variations.variations)
        // }
        // removes exact duplicates
        word = word.filter((w,i) => {
            return word.indexOf(w) == i
        })
        word = word.filter(w => w != this.word)
        // console.log(`Found ${word.length} synonyms`)
        return word
    }
    antonyms(){
        var info = dictionary.get(this.word)
        if(info) {
            if(info.ANTONYMS) {
                var antonyms = info.ANTONYMS.filter(anty=>!anty.includes("_"))
                // console.log(`${this.word}`,antonyms);
                return antonyms
            }
        }
        return []
    }
    getSynonymWeights(){
        return this.synonyms.map(syn => {
            return {
                word: syn,
                score: this.Class.getWeight(syn)
            }
        })
    }
    getAntonymWeights(){
        return this.antonyms().map(anty => {
            return {
                word: anty,
                score: -this.Class.getWeight(anty)
            }
        })
    }
}

export class Class {
    model = null
    _weights = {}
    documents = []
    totalWords = 0

    constructor(model,options) {
        this.model = model
        if(options){
            if(options.weights){
                options.weights.forEach(weight => {
                    this._weights[weight.word] = new Weight(this,weight.word,weight.count)
                })
            }
            this.totalWords = options.totalWords || 0
        }
    }
    get name(){
        // gets the key of the class
        return Object.keys(this.model._classes)[Object.keys(this.model.classes).find(key => this.model.classes[key] == this)]
    }
    get weights() {
        return Object.values(this._weights)
    }
    get sortedWeights(){ 
        var weights = Object.values(this._weights)
        weights = weights.sort((a,b) => b.weight - a.weight)
        return weights
    }
    get export(){
        var exportObj = {}
        exportObj.name = this.name
        exportObj.weights = this.weights.map(w => {
            return {
                word: w.word,
                count: w.count
            }
        }).sort((a,b) => b.count - a.count)
        exportObj.totalWords = this.totalWords
        exportObj.documents = this.documents
        return exportObj
    }
    addWeight(word = "",count){
        word = word.toLowerCase()
        if(this._weights[word]){
            this._weights[word].count += count
        }else{
            this._weights[word] = new Weight(this,word,count)
        }
    }
    learn(weights = [],document = ""){
        // console.log("Learning",this.name,weights.length);
        for(let weight of weights){
            this.addWeight(weight.word,-weight.count)
        }
        if(document.length > 0) this.documents.push(document)
    }
    getWordWeight(word){
        word = word.toLowerCase()
        if(this._weights[word]) {
            return this._weights[word].weight
        }
        return 0
    }
    getSynonymWordWeight(word){
        word = word.toLowerCase()
        if(this._weights[word]) {
            this._weights[word].antonyms()
            return this._weights[word].synonymWeight
        }
        return 0
    }
    getAntonymWordWeight(word){
        word = word.toLowerCase()
        if(this._weights[word]) {
            this._weights[word].antonyms()
            return this._weights[word].antonymWeight
        }
        return 0
    }
    getComplexWordWeight(word){
        word = word.toLowerCase()
        if(this._weights[word]) {
            return this._weights[word].complexWeight
        }
        return 0
    }
    getWeight(text){
        var words = text.split(" ")
        var weight = 0
        for(var word of words){
            weight += this.getWordWeight(word)
        }
        return weight/words.length
    }
    getSynonymWeight(text){
        var words = text.split(" ")
        var weight = 0
        for(var word of words){
            weight += this.getSynonymWordWeight(word)
        }
        return weight/words.length
    }
    getAntonymWeight(text){
        var words = text.split(" ")
        var weight = 0
        for(var word of words){
            weight += this.getAntonymWordWeight(word)
        }
        return weight/words.length
    }
    getComplexWeight(text){
        var words = text.split(" ")
        var weight = 0
        for(var word of words){
            weight += this.getComplexWordWeight(word)
        }
        return weight/words.length
    }
    getTop(n){
        var top = []
        for(var i = 0; i < n; i++){
            top.push(this.sortedWeights[i])
        }
        return top
    }
    getSortedIndex(word){
        word = word.toLowerCase()
        return this.sortedWeights.findIndex(w => w.word == word)
    }
    getWordsAround(word, n=5){
        var before = []
        var after = []
        var weights = this.sortedWeights
        var wordIndex = this.getSortedIndex(word)
        for(var i = 0; i > -n; i--){
            before.push(weights[wordIndex + i])
        }
        for(var i = 0; i < n; i++){
            after.push(weights[wordIndex + i])
        }
        return {before, after,word:this.getWeight(word)}
    }
    compareWeights(weights){
        var total = 0
        for (const weight of weights) {
            total += diff(this.getWordWeight(weight.word),weight.weight)
        }
        return total
    }
    compareSynonymWeights(weights){
        // console.log("Comparing expanded weights",this.name)
        var total = 0
        for (const weight of weights) {
            total += diff(this.getSynonymWordWeight(weight.word),weight.weight)
        }
        return total
    }
    compareAntonymWeights(weights){
        var total = 0
        for (const weight of weights) {
            total += diff(this.getAntonymWordWeight(weight.word),weight.weight)
        }
        return total
    }
    compareComplexWeights(weights){
        var total = 0
        for (const weight of weights) {
            total += diff(this.getComplexWordWeight(weight.word),weight.weight)
        }
        return total
    }
    refine(){

    }
}

export class Model{
    _classes = {}
    name = ""
    totalWords = 0
    learnIndex = 0
    constructor(model){
        if(model){
            this.name = model.name || ""
            this.totalWords = model.totalWords || 0
            this.learnIndex = model.learnIndex || 0
            if(model.classes){
                for(let className in model.classes){
                    this._classes[className] = new Class(this,model.classes[className])
                }
            }
        }
    }
    get classes(){
        return Object.values(this._classes)
    }
    get classNames(){
        return Object.keys(this._classes)
    }
    get export(){
        var exportObj = {
            classes: {},
            totalWords: this.totalWords,
            name: this.name,
            learnIndex: this.learnIndex
        }
        for(let className in this._classes){
            exportObj.classes[className] = this._classes[className].export
        }
        return exportObj
    }
    getSimpleWeight(text = ""){
        if(text.length == 0) return {
            error: "No text provided"
        }
        var weights = getWeights(text).weights
        var Weights = []
        for (const Class of this.classes) {
            Weights.push({
                class: Class.name,
                score: Class.compareWeights(weights),
            })
        }
        Weights = Weights.map(w=>{
            w.score = 1-w.score
            // w.weight = 1-w.weight
            return w
        })
        Weights = Weights.sort((a,b) => b.score - a.score)
        return Weights
    }
    getSynonymWeight(text = ""){
        if(text.length == 0) return {
            error: "No text provided"
        }
        var weights = getWeights(text).weights
        var Weights = []
        for (const Class of this.classes) {
            Weights.push({
                class: Class.name,
                score: Class.compareSynonymWeights(weights),
            })
        }
        Weights = Weights.map(w=>{
            w.score = 1-w.score
            // w.weight = 1-w.weight
            return w
        })
        Weights = Weights.sort((a,b) => b.score - a.score)
        return Weights
    }
    getAntonymWeight(text = ""){
        if(text.length == 0) return {
            error: "No text provided"
        }
        var weights = getWeights(text).weights
        var Weights = []
        for (const Class of this.classes) {
            Weights.push({
                class: Class.name,
                score: Class.compareAntonymWeights(weights),
            })
        }
        Weights = Weights.map(w=>{
            w.score = 1-w.score
            // w.weight = 1-w.weight
            return w
        })
        Weights = Weights.sort((a,b) => b.score - a.score)
        return Weights
    }
    getComplexWeight(text = ""){
        if(text.length == 0) return {
            error: "No text provided"
        }
        var weights = getWeights(text).weights
        var Weights = []
        for (const Class of this.classes) {
            Weights.push({
                class: Class.name,
                score: Class.compareComplexWeights(weights),
            })
        }
        Weights = Weights.map(w=>{
            w.score = 1-w.score
            // w.weight = 1-w.weight
            return w
        })
        Weights = Weights.sort((a,b) => b.score - a.score)
        return Weights
    }
    get(text = "", types = ["simple"]){
        if(text.length == 0) return {
            error: "No text provided"
        }
        if(types.includes("simple") && types.length == 1) return this.getSimpleWeight(text)
        if((types.includes("synonyms") || types.includes("synonym")) && types.length == 1) return this.getSynonymWeight(text)
        if((types.includes("antonyms") || types.includes("antonym")) && types.length == 1) return this.getAntonymWeight(text)
        if(types.includes("complex") && types.length == 1) return this.getComplexWeight(text)
        if(types.length < 1) types = ["simple"]
        var results = []
        types.forEach(type => {
            switch(type){
                case "synonym":
                case "synonyms":
                    results.push({
                        type: "synonym",
                        results: this.getSynonymWeight(text)
                    })
                    break
                case "antonym":
                case "antonyms":
                    results.push({
                        type: "antonym",
                        results: this.getAntonymWeight(text)
                    })
                    break
                case "complex":
                    results.push({
                        type: "complex",
                        results: this.getComplexWeight(text)
                    })
                    break
                case "simple":
                default:
                    results.push({
                        type: "simple",
                        results: this.getSimpleWeight(text)
                    })
                    break
            }
        })
        // combines and averages results
        var combined = []
        for (const result of results) {
            for (const result2 of result.results) {
                var found = false
                for (const combinedResult of combined) {
                    if(combinedResult.class == result2.class){
                        found = true
                        combinedResult.score += result2.score
                    }
                }
                if(!found){
                    combined.push({
                        class: result2.class,
                        score: result2.score
                    })
                }
            }
        }
        combined = combined.map(c=>{
            c.score = c.score/results.length
            return c
        })
        combined = combined.sort((a,b) => b.score - a.score)
        return combined
    }
    applyWeights(className,weights,wordCount,document){
        // console.log("Applying weights to",className,weights[0],wordCount);
        className = className.replace(/\s/g, '')
        var negative = false
        if(className.startsWith("-")) {
            negative = true
            className = className.substring(1)
        }
        if(!this._classes[className]) this._classes[className] = new Class(this,className,{
            wordCount
        })
        this._classes[className].learn(weights,document,negative)
        this.totalWords += wordCount
        this._classes[className].totalWords += wordCount
    }
    // Saves the model to a model directory in the ./models directory -- Contains a model.json file and a classes directory with a class.json file for each classes
    save(to = ""){
        console.log("Saving model...");
        to = "./models/"+to
        if(this.name != "" && to == ""){
            to = "./models/"+this.name
        }
        var model = this.export
        var classes = Object.entries(model.classes)
        delete model.classes
        fs.mkdirSync(to+"/classes",{recursive:true})
        fs.writeFileSync(path.join(to,"model.json"),JSON.stringify(model))
        for(let CLS of classes){
            fs.writeFileSync(path.join(to,"classes",CLS[0]+".json"),JSON.stringify(CLS[1]))
        }
        return this
    }
    load(from = ""){
        console.log("Loading model...");
        var exists = this.modelExists(from)
        if(exists){
            from = "./models/"+from
            if(this.name != "" && from == ""){
                from = "./models"+this.name
            }
            var model = JSON.parse(fs.readFileSync(path.join(from,"model.json")))
            var classes = fs.readdirSync(path.join(from,"classes"))
            model.classes = {}
            for(let className of classes){
                model.classes[className.replace(".json","")] = JSON.parse(fs.readFileSync(path.join(from,"classes",className)))
            }
            var model = new Model(model)
            return model
        }else{
            console.error("Model does not exist")
            return false
        }
    }
    delete(model){
        if(this.modelExists(model)){
            fs.unlinkSync(path.join("./models",model))
            return true
        }else{
            console.error("Model does not exist")
            return false
        }
    }
    modelExists(name){
        return fs.existsSync(path.join("./models/",name))
    }
}
export async function load(model){
    if(Model.prototype.modelExists(model)){
        return Model.prototype.load(model)
    }else{

    }
}
/** Old, but technically works fine */
export async function oldTrain(name,dataset,options = {
    checkpoint: false,
    resume: false,
}){
    console.log(`Training '${name}' model...`);
    var trainingDir = "./old_training/"+dataset
    var trainingFiles = await fs.promises.readdir(trainingDir)

    var model = new Model({
        name
    })
    var resume = options.resume || false
    
    var lastCheckpoint = 0
    if(resume){
        if(checkpoint){
            if(Model.prototype.modelExists("checkpoint")) {
                console.log("Loading to resume checkpoint...");
                model = Model.prototype.load("checkpoint")
            }
        }else{
            if(Model.prototype.modelExists(name)) {
                console.log("Loading to resume model...");
                model = Model.prototype.load(name)
            }
        }
    }
    lastCheckpoint = model.learnIndex
    var i = 0
    for (const file of trainingFiles) {
        if(i<lastCheckpoint) i++
        else{
            var tags = file.split(".")[0].split("---")[0].split(" ").map(tag => tag.replace(/-/g," ").replace(/_/g,"-"))
            if(!file.startsWith("---")){
                var filePath = trainingDir + "/" + file
                if(model.learnIndex%5 == 0){
                    console.log(`Reading ${model.learnIndex} of ${trainingFiles.length}, ${filePath}, Tags: ${tags.join(", ")}...`)
                }
                var fileContents = await fs.promises.readFile(filePath, "utf8")
                if(fileContents.length > 0) {
                    var fileWeights = getWeights(fileContents)
                    tags.forEach(tag => model.applyWeights(tag, fileWeights.weights,fileWeights.totalWords,filePath))
                    model.totalWords += fileWeights.totalWords
                }
            }
            if(resume){
                if(checkpoint){
                    if(model.learnIndex%10000 == 0 && model.learnIndex != lastCheckpoint){
                        console.log("Saving checkpoint...");
                        model.save("checkpoint")
                    }
                }
            }
            model.learnIndex++
        }
    }
    console.log("Testing Model...");
    var text = "Sweetie Belle went to the moon and saw Princess Luna!"
    var weights = model.getSimpleWeight(text)
    console.log("Text:",text)
    console.log("Weights:",weights)
    // Model.prototype.delete("checkpoint")
    model.save(name)
    return model
}
export async function train(name,dataset,options = {
    checkpoint: false,
    resume: false,
}){
    console.log(`Training '${name}' model...`);
    var trainingDir = "./training/"+dataset
    var trainingFiles = await fs.promises.readdir(trainingDir)

    var model = new Model({
        name
    })
    var resume = options.resume || false
    
    var lastCheckpoint = 0
    if(resume){
        if(checkpoint){
            if(Model.prototype.modelExists("checkpoint")) {
                console.log("Loading to resume checkpoint...");
                model = Model.prototype.load("checkpoint")
            }
        }else{
            if(Model.prototype.modelExists(name)) {
                console.log("Loading to resume model...");
                model = Model.prototype.load(name)
            }
        }
    }
    lastCheckpoint = model.learnIndex
    var i = 0
    for (var file of trainingFiles) {
        if(i<lastCheckpoint) i++
        else{
            var filePath = path.join(trainingDir,file)
            file = JSON.parse(await fs.promises.readFile(filePath))
            var tags = file.tags
            if(model.learnIndex%5 == 0){
                console.log(`Reading ${model.learnIndex} of ${trainingFiles.length}, ${filePath}, Tags: ${tags.join(", ")}...`)
            }
            var fileWeights = getWeights(file.text)
            tags.forEach(tag => model.applyWeights(tag, fileWeights.weights,fileWeights.totalWords,filePath))
            model.totalWords += fileWeights.totalWords
            if(resume){
                if(checkpoint){
                    if(model.learnIndex%10000 == 0 && model.learnIndex != lastCheckpoint){
                        console.log("Saving checkpoint...");
                        model.save("checkpoint")
                    }
                }
            }
            model.learnIndex++
        }
    }
    console.log("Testing Model...");
    var text = "Sweetie Belle went to the moon and saw Princess Luna!"
    var weights = model.getSimpleWeight(text)
    console.log("Text:",text)
    console.log("Weights:",weights)
    // Model.prototype.delete("checkpoint")
    model.save(name)
    return model
}
/** Gets the weights of text */
export function getWeights(text = "",threads = 128) {
    if(text.length <1) return {
        error : "Document is empty"
    }
    var words = text.replace(/[^\w\s]/gi, '').toLowerCase().split('\n').map(line => line.split(' ')).flat();
    
    // words = words.reduce((acc, line) => acc.push(line), [])
    words = words.filter(word => word.length > 0)
    var wordCounts = {};

    var Threads = []
    // split the words into threads chunks
    var chunkSize = Math.ceil(words.length / threads);
    for (var i = 0; i < threads; i++) {
        var start = i * chunkSize;
        var end = start + chunkSize;
        Threads.push(words.slice(start, end));
    }
    Threads.forEach(async thread => {
        thread.forEach(async word => {
            // word = word.toLowerCase();
            // removes punctuation
            word = word.replace(/\r/g,"")
            if(word.length > 0) wordCounts[word] = (wordCounts[word] || 0) + 1;
        });
    })

    var wordCountsSorted = Object.keys(wordCounts).sort((a, b) => wordCounts[b] - wordCounts[a]).map(word => ({ 
        word, 
        count: wordCounts[word],
        weight: wordCounts[word] / words.length
    }))
    return {
        weights: wordCountsSorted,
        uncommonWeights: wordCountsSorted.filter(word => topEngWords.indexOf(word.word) === -1),
        commonweights:wordCountsSorted.filter(word => topEngWords.indexOf(word.word) !== -1),
        totalWords: words.length
    }
}