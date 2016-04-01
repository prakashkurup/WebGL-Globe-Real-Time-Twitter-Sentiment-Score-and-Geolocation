var express = require('express');
var router = express.Router();


var xx = require("./index.js");




router.get('/', function(req, res, next) {


xx.addressName=req.param('name');
console.log(xx.addressName);
res.send("received");


});

module.exports=router;


// var address = function(){

//    return name;

// };