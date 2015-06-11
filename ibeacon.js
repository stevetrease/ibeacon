console.log("process.env.NODE_ENV:" + process.env.NODE_ENV);
switch (process.env.NODE_ENV) {
	case 'development':
		console.log ("development mode");
		var config = require('./config.json');
		break;
	case 'production':
	default:	
		console.log ("production mode");
		var config = require('./config.json');
}




var http = require('http');
var redis = require('redis')
   ,redisClient = redis.createClient(parseInt(config.redis.port,10), config.redis.host);
var express = require('express');
var bodyParser = require('body-parser');

redisClient.on('connect'     , log('redis connect'));
redisClient.on('ready'       , log('redis ready'));
redisClient.on('reconnecting', log('redis reconnecting'));
redisClient.on('error'       , log('redis error'));
function log(type) {
    return function() {
        console.log(type, arguments);
    }
}


var mqtt = require('mqtt');
var mqttclient = mqtt.connect(config.mqtt.host);



var app = express();
app.use(bodyParser());


app.get('/', function(req, res) {
	var now = new Date();
	res.writeHead(200, {'Content-Type': 'text/plain'});
  	res.end(req.method + " from " + req.connection.remoteAddress);
    	console.log(req.connection.remoteAddress + " " + req.method + " " + now);
});



// dealing with ibeacon stuff
app.post('/ibeacon', function(req, res) {
	var now = new Date();

	// deal with posts from Beecon app
	var region = req.body.region;
	var beacon = req.body.beacon;
	var action = req.body.action;
	var distance = req.body.distance;
	var major = req.body.major;
	var minor = req.body.minor;

	if (region != null ) { 
		if (beacon != null ) { 
			res.writeHead(200, {'Content-Type': 'text/plain'});
  			res.end(region + " " + action);
			console.log("beacon " + req.connection.remoteAddress + " " + region + "," + beacon + "," + major + "," + minor + " " + distance);
		} else {
			res.writeHead(200, {'Content-Type': 'text/plain'});
  			res.end(region + " " + action);
			console.log("region " + req.connection.remoteAddress + " " + region + " " + action);
		}
	}
});




app.post('/swiftpush', function(req, res) {
	// record and post new Swift Push token
	var token = req.body.token;
	var device = req.body.device;
	var mode = req.body.mode;
	var version = req.body.version;
	
	console.log(req.connection.remoteAddress + " " + 'POST ' + device + " (" + version + ") with " + token + " in mode " + mode)
	
	if (mode == "sandboxReceipt") {
		redisClient.sadd("push-tokens-devices-sand", JSON.stringify({token: token, device: device}));
		redisClient.sadd("push-tokens-devices", JSON.stringify({token: token, device: device}));
		redisClient.publish("push-tokens-change", token);
	} else {
		redisClient.sadd("push-tokens-devices-sand", JSON.stringify({token: token, device: device}));
		redisClient.sadd("push-tokens-devices", JSON.stringify({token: token, device: device}));
		redisClient.publish("push-tokens-change", token);
	}
	
	mqttclient.publish("push/alert", "token registration from " + device + " (" + version + ") in mode " + mode);
	
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end(req.connection.remoteAddress + " " + 'POST ' + device + " with " + token + " in mode " + mode);

});


app.post('/battery', function(req, res) {
	// record and post new Swift Push token
	var device = req.body.device;
	var batterystate = req.body.batterystate;
	var batterylevel = req.body.batterylevel;
	
	console.log(req.connection.remoteAddress + " " + 'POST ' + device + " " + batterystate + " " + batterylevel);
	
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end(req.connection.remoteAddress + " "  + 'POST ' + device + " " + batterystate + " " + batterylevel);
});



app.listen(config.port);
