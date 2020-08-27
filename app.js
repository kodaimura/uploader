const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('uploads.db');
const admZip = require('adm-zip');

const multer = require('multer');
const storage =  multer.diskStorage({
  destination: './zips',
  filename (req, file, cb) {
    cb(null, req.body.sId + file.originalname);
}
});
const upload = multer({ storage: storage });

const PORT = process.env.PORT || 7000;

app.use(bodyParser.urlencoded({extended: true}));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static('./'));  //アップされたhtml,css,js繋げるのに重要

app.listen(PORT, function(){
	console.log("Server started on port:" + PORT);
});

app.get("/", function(req, res){
	res.render('index');
});

app.post("/", upload.single('file'), function(req, res){
	let zipfile = req.body.sId + req.file.originalname;
	let sId = req.body.sId
	let password = Math.random().toString(36).substring(5);
	let zip =  new admZip(__dirname + '/zips/' + zipfile)
	let html = ""

	zip.extractAllTo(__dirname + '/opens/' + 
		zipfile.substring(0, zipfile.lastIndexOf(".")), true);

	for (const zipEntry of zip.getEntries()) {
		if (zipEntry.entryName[0] !== "_" &&
			zipEntry.entryName.slice(-5).toUpperCase() === ".HTML"){
			html = zipEntry.entryName
			db.serialize(function(){
				db.run(`CREATE TABLE IF NOT EXISTS zipfiles 
					(id INTEGER PRIMARY KEY AUTOINCREMENT, sId TEXT UNIQUE, 
					password TEXT, zipfile TEXT, html TEXT)`);
				db.run(`REPLACE INTO zipfiles (sId, password, zipfile, html) 
					values("${sId}","${password}","${zipfile.substring(0, zipfile.lastIndexOf("."))}","${html}")`);
			});

			res.send(`<h2>受け取りました</h2><br>
				閲覧用パスワードは<h3>${password}</h3>です。記録してください。
				<br><a href="./">戻る</a>`);
			break;
		}
	}
	if (html === ""){
		res.send(`zipの中にhtmlが含まれていません。<br><a href="./">戻る</a>`);
	}
	
});

app.get("/list", function(req, res){
	db.serialize(function(){
		db.all(`SELECT sId,zipfile,html FROM zipfiles`, function(err, rows){
			res.render('list', {reportlist: rows});
		})
	});
});


app.post("/opens/:folder/:html", function(req, res){
	let sId = req.body.sId
	let password = req.body.password
	db.serialize(function(){
		db.get(`SELECT zipfile, html FROM zipfiles 
			WHERE sId="${sId}" and password="${password}"`, function(err, row){
				if (row === undefined){
					res.redirect('../../list');
				}else{
					res.sendFile(__dirname + '/opens/' + req.params.folder + '/' + req.params.html);
				}
			})
	});
});

