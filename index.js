const express = require('express');
const mysql = require('mysql2');
const fileUpload = require('express-fileupload');
const csv = require('csv-parser')
const fs = require('fs')

const app = express();
app.set("view engine", "ejs");
app.use(fileUpload());
app.use(express.static(__dirname));

const con = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'mydb',
    password: "MyServer123"
});

con.connect((err) => {
    if (err) throw err;
    console.log("connected");
});

app.get("/import", function(req, res){
    res.render("import", { insertedRows: req.query.insertedRows });
});


app.post("/upload", (req, res) => {
    const isUserCsv = Boolean(req.files?.users_csv);
    const isPostCsv = Boolean(req.files?.posts_csv);
    const isCommentCsv = Boolean(req.files?.comments_csv);
    const data_csv = req.files?.users_csv ?? req.files?.posts_csv ?? req.files?.comments_csv;

    data_csv.mv(__dirname + "/csvs/data.csv", function(err) {
        console.log(err);
    });

    const results = [];

    fs.createReadStream(__dirname + "/csvs/data.csv")
    .pipe(csv())
    .on('data', (data) => {

        Object.keys(data).forEach(key => {
            data[key] = data[key] === "NULL" ? null : data[key];
        });

        if (isUserCsv) 
            results.push([data.mInitial, data.fName, data.lName, data.biography, data.location, data.birthday]);
        else if (isPostCsv) 
            results.push([data.likeCount, data.location, data.content, data.photoURL, data.userID, data.date, data.eventID, data.groupID, data.trendID]);
        else if (isCommentCsv) 
            results.push([data.userID, data.content, data.numLikes, data.date, data.postID]);
    })
    .on('end', () => {
        let query = "";

        if (isUserCsv)
            query = "INSERT INTO user (mInitial, fName, lName, biography, location, birthday) VALUES ?";
        else if (isPostCsv)
            query = "INSERT INTO post (likeCount, location, content, photoURL, userID, date, eventID, groupID, trendID) VALUES ?";
        else if (isCommentCsv)
            query = "INSERT INTO comment (userID, content, numLikes, date, postID) VALUES ?";
        
        con.query(query, [results], (err, result, fields) => {
            if (err) throw err;
            console.log("Insert successful");
            res.redirect("/import?insertedRows=" + result.affectedRows);
        })
    })
})

app.get("/users", (req, res) => {
    const userQuery = "SELECT * FROM user";
    const postQuery = "SELECT * FROM post";

    con.query(userQuery, (err, users, fields) => {
        if (err) throw err;

        con.query(postQuery, (err, posts, fields) => {
            if (err) throw err;

            res.render("users", { users: users, posts: posts });
        })
    })
})

app.get("/posts", (req, res) => {
    const postQuery = "SELECT * FROM post";
    const commentQuery = "SELECT * FROM comment";

    con.query(postQuery, (err, posts, fields) => {
        if (err) throw err;

        con.query(commentQuery, (err, comments, fields) => {
            if (err) throw err;

            res.render("users", { posts: posts, comments: comments });
        })
    })
})

app.get("/comments", (req, res) => {
    const commentQuery = "SELECT * FROM comment";
    const userQuery = "SELECT * FROM user";

    con.query(commentQuery, (err, comment, fields) => {
        if (err) throw err;

        con.query(userQuery, (err, user, fields) => {
            if (err) throw err;

            res.render("users", { users: users, comments: comments });
        })
    })
})

app.listen(3000, function() {
    console.log('App listening on port 3000!');
});