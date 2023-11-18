const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const async = require('async');
const ObjectsToCsv = require('objects-to-csv');

const nodemailer = require('nodemailer');
var sesTransport = require('nodemailer-ses-transport');
var smtpPassword = require('aws-smtp-credentials');
const config = require('dotenv').config({ path: '/path/to/env/file' })

			
var mailTransporter = nodemailer.createTransport({
  port: 465,
  host: 'email-smtp.us-east-1.amazonaws.com',
  secure: true,
  auth: {
    user: process.env.accessKeyId,
    pass: smtpPassword(process.env.accessKey),
  },
  debug: true
});


const url = 'mongodb://localhost:27017';
const dbName = 'kickraju';

MongoClient.connect(url, function(err, client) {
    assert.equal(null, err);
    console.log("Connected successfully to server");

    const db = client.db(dbName);
    start(db);
});

function start(db) {
    db.collection('alarms').distinct('source_username', {sent: null}, (err, users) => {
        async.eachSeries(users, (item, cb) => {
            db.collection('alarms').find({
                source_username: item, 
                sent: null
            },{ projection: { _id: 0}}).toArray((err, res) => {
                async function printCsv(data) {
                    let csvdata = await new ObjectsToCsv(data).toString()
                    

                    
                    let mailDetails = {
	from: 'security <security@domain.com>',
	to: `${item}`,
	cc: `security@domain.com`,
	subject: 'File shared outside company over email',
	html: `<html>
<body>

<p>As part of Security Monitoring, we observed that you have shared a few files which are mentioned in below attachment to the external user's email address</p>
<br>
<p>As part of our Security Policy, Can you answer the questions below ?
</p>
<p>1. Why is the transfer of files done to external email address ?
</p>
<p>2. Who is that recipient ? Customer or Personal
</p>
<p>3. What is that file and does it belong to our company ?
</p>


</body>
</html>`,
attachments: [
      {
        filename: "file.csv",
        content: csvdata,
      },
    ]
};

mailTransporter.sendMail(mailDetails, function(err, data) {
	if(err) {
		console.log(err);
	} else {
		
		db.collection('alarms').update({source_username: item}, {$set:{sent: 1}}, {multi:true}, (
			err, res) => {
			console.log('Email sent successfully ======>>>', item);
			cb();
		})
	}
});


                }
                printCsv(res);
            })
        }, (error, resp) => {
        	console.log('============================');
        })
    })
}
