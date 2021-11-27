import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

class LetterManager{
    _data = {}
    constructor(data){
        var Data = {}
        Object.keys(data).forEach(key => {
            Data[key.toLowerCase()] = data[key];
        })
        this._data = Data;
    }
    get data(){
        return Object.values(this._data);
    }
    get(word){
        if(!this._data[word.toLowerCase()]){
            return null;
        }else{
            return this._data[word.toLowerCase()];
        }
    }
}
class DictionaryManager {
    _data = null
    constructor(data){
        this._data = data;
    }
    get data() {
        return Object.values(this._data)
    }
    get(word) {
        var letter = word.slice(0, 1).toLowerCase();
        // console.log(letter);
        // console.log(this._data[letter]);
        if(this._data[letter]){
            return this._data[letter].get(word);
        }else{
            return false
        }
    }
}

var dir = path.dirname(fileURLToPath(import.meta.url))+'/data/';
var files = fs.readdirSync(dir);
var data = {};
for (const filename of files) {
    var letter = filename.slice(1, 2).toLowerCase()
    data[letter] = new LetterManager(JSON.parse(fs.readFileSync(dir + filename, 'utf8')));
}
// console.log(data);
export default new DictionaryManager(data);