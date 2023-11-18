var request = require('request');
var async = require('async');
var unique = require('unique-array');
var hdate = require('human-date')
const config = require('dotenv').config({
    path: '/path/to/env/file'
});

let alarm_array = [];

let individual_alarm_array = [];

let final_alarms = [];

let username_array = [];

let token;

const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');


const url = 'mongodb://localhost:27017';
const dbName = 'kickraju';

MongoClient.connect(url, function(err, client) {
    assert.equal(null, err);
    console.log("Connected successfully to server");

    const db = client.db(dbName);
    start(db);
});


function start(db) {
    function extract(final_alarms) {
        async.forEach(final_alarms, (item, cb) => {
            console.log(item.message.event_name + "--->>" + item.message.file_type + "--->>" + item.message.file_owner + "--->>" + item.message.timestamp_received + "--->>" + item.message.source_username + "--->>" + item.message.destination_username + "--->>" + item.message.file_name);
            db.collection('alarms').insert({event_name: item.message.event_name, file_type: item.message.file_type, file_owner: item.message.file_owner, timestamp: hdate.prettyPrint(new Date(parseInt(item.message.timestamp_received)), { showTime: true }), source_username: item.message.source_username, destination_username: item.message.destination_username, file_name: item.message.file_name}, (err, result) => {
              cb();  
            })
        }, (err, res) => {
            console.log('=========================================')
        })
    }

    function individualFilterOut(alarm_array) {
        async.forEach(alarm_array, (item, cb) => {
            async.forEach(item.events, (sub_item, cb1) => {
                final_alarms.push(sub_item);
                cb1();
            }, (err, res) => {
                cb()
            })

        }, (err, res) => {
            extract(final_alarms);
        })
    }


    function filterOut(alarms_data) {
        async.forEach(alarms_data, (alarm, cb) => {
            if (alarm.destination_username.indexOf('@domain.com') == -1 && alarm.destination_username.indexOf('@domain2.com') == -1) {
                alarm_array.push(alarm);
                cb();
            } else {
                cb();
            }
        }, (err, res) => {
            individualFilterOut(alarm_array);
        })
    }



    let promise = new Promise((resolve, reject) => {

        var dataString = '@request_body';

        var options = {
            url: 'https://giveyoururl.com/api/2.0/oauth/token?grant_type=client_credentials',
            method: 'POST',
            body: dataString,
            auth: {
                'user': process.env.API_USERNAME,
                'pass': process.env.API_PASSWORD
            }
        };

        function callback(error, response, body) {
            if (!error && response.statusCode == 200) {
                let result = JSON.parse(body);
                token = result.access_token;
                console.log(result.access_token);
                resolve(result.access_token);
            } else {
                reject("error at generating access token");
            }
        }

        request(options, callback);

    })


    promise.then((accessToken) => {

        var headers = {
            'Authorization': `Bearer ${accessToken}`
        };

        var options = {
            url: `https://yoururl.com/api/2.0/alarms?size=1000&status=open&rule_intent=Environmental%20Awareness&rule_method=File%20Shared%20Externally&rule_strategy=Filesharing%20outside%20IV%20over%20email&priority_label=low&alarm_sensor_sources=cf60463c-de16-45ff-946e-627aecbb53d9&timestamp_occured_gte=${parseInt(Date.now())-86400000}&timestamp_occured_lte=${Date.now()}`,
            headers: headers
        };

        function callback(error, response, body) {
            if (!error && response.statusCode == 200) {
                let alarms_data = JSON.parse(body)._embedded.alarms;
                filterOut(alarms_data);
            } else {
                console.log("Error at getting alarms data");
            }
        }

        request(options, callback);


    }).catch((error) => {
        console.log(error);
    })

}
