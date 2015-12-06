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



var topicHistory = {};

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

	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end(req.connection.remoteAddress + " " + 'POST ' + device + " with " + token + " in mode " + mode);
	console.log(req.connection.remoteAddress + " " + 'POST token registration from ' + device + " (" + version + ") with " + token + " in mode " + mode)

	mqttclient.publish("push/alert", "token registration from " + device + " (" + version + ") in mode " + mode);
	if (mode == "sandboxReceipt") {
		redisClient.sadd("push-tokens-devices-sand", JSON.stringify({token: token, device: device}));
		redisClient.sadd("push-tokens-devices", JSON.stringify({token: token, device: device}));
		redisClient.publish("push-tokens-change", token);
	} else {
		redisClient.sadd("push-tokens-devices-sand", JSON.stringify({token: token, device: device}));
		redisClient.sadd("push-tokens-devices", JSON.stringify({token: token, device: device}));
		redisClient.publish("push-tokens-change", token);
	}
});


app.post('/battery', function(req, res) {
	var device = req.body.device;
	var batterystate = req.body.batterystate;
	var batterylevel = parseFloat(req.body.batterylevel);
	var reason = req.body.reason; 
	
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end(req.connection.remoteAddress + " "  + 'POST ' + batterylevel.toFixed(2) + " " + batterystate + " " + device);
	
	console.log(req.connection.remoteAddress + " " + 'POST battery level of ' + batterylevel.toFixed(2) + " " + batterystate + " " + device + " (" + reason + ")");
	
	mqttclient.publish("sensors/iosbattery/" + device, batterylevel.toFixed(2));
	mqttclient.publish("push/message", device + " is " + batterystate.toLowerCase() + " at " + batterylevel * 100 + "%");
});


app.post('/arduino', function(req, res) {
	var device = req.body.device;
	var sensor = req.body.sensor;
	var value = parseFloat(req.body.value);
	
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end(req.connection.remoteAddress + " " + "POST " + device + " " + sensor + " " + value);
	console.log(req.connection.remoteAddress + " " + "POST " + device + " " + sensor + " " + value);
});

app.get('/sensors/*', function(req, res) {
	var topic = req.path.slice(1,req.path.length); 
	// console.log(topic + "     " + topicHistory[topic]);
	if(typeof topicHistory[topic] === 'undefined') {
		// topic does NOT exist	
		console.log(req.connection.remoteAddress + " " + "GET " + topic + " does not exist");
		res.writeHead(404, {'Content-Type': 'text/plain'});
		res.end(req.path + " does not exist\n");	
	} else {
		var value = topicHistory[topic];
		console.log(req.connection.remoteAddress + " " + "GET " + topic + " " + value);	
		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.end(value.toString());
	}
});	
	
app.get('/light/*', function(req, res) {
	var topic = req.path.slice(1,req.path.length); 
	console.log (req.path);
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end();
});	
app.get('/lightrgb/*', function(req, res) {
	var tags = req.path.split("/");
	
	var node = tags[2];
	var mode = tags[3];
	var rgb = tags[4];
		
	switch(mode) {
    	case "on":
        	console.log("node: " + node + " on");
        	mqttclient.publish("photon/" + node, "ffffff");
			break;
		case "off":
			console.log("node: " + node + " off");
			mqttclient.publish("photon/" + node, "000000");
			break;
		case "rgb":
			console.log("node: " + node + rgb);
			mqttclient.publish("photon/" + node, rgb);
			break;
		default:
        	console.log ("unknown mode: " + mode)
	}

	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end();
});	
	
	
	
	


var mqtt = require('mqtt');
var mqttclient = mqtt.connect(config.mqtt.host);

mqttclient.on('connect', function() {
    mqttclient.subscribe('sensors/+/+');
        
    mqttclient.on('message', function(topic, message) {    
	    var value = Number(message);
        topicHistory[topic] = value;
        // console.log ("adding " + topic);
    });
});


app.listen(config.port);
