import express from 'express';
import mysql from 'mysql2/promise';
import fileUpload from 'express-fileupload';
import neatCsv from 'neat-csv';

const app = express();
app.set("view engine", "ejs");
app.use(fileUpload());
app.use( express.static( "public" ) );

const con = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'mydb',
    password: "MyServer123"
});

app.get("/import", function(req, res){
    res.render("import", { insertedRows: req.query.insertedRows, errors: [] });
});


app.post("/import", async (req, res) => {
    const isUserCsv = Boolean(req.files?.users_csv);
    const isPostCsv = Boolean(req.files?.posts_csv);
    const isCommentCsv = Boolean(req.files?.comments_csv);

    if (!isUserCsv && !isPostCsv && !isCommentCsv) {
        res.render("import", { insertedRows: 0, errors: ["No CSV has been uploaded"] });
        return;
    }

    const data_csv = req.files?.users_csv ?? req.files?.posts_csv ?? req.files?.comments_csv;

    const data = await neatCsv(data_csv.data.toString('utf8'));

    for (const d of data) {
        for (const key of Object.keys(d)) {
            if (d[key] === "NULL") d[key] = null;
        }
    }

    let insertedRows = 0;

    const results = await Promise.all(data.map(async d => {
        let query = "";
        let input = [];
        
        if (isUserCsv) {
            query = "INSERT INTO user (mInitial, fName, lName, biography, location, birthday) VALUES (?)";
            input = [d.mInitial, d.fName, d.lName, d.biography, d.location, d.birthday];
        }
        else if (isPostCsv) {
            query = "INSERT INTO post (likeCount, location, content, photoURL, userID, date, eventID, groupID, trendID) VALUES (?)";
            input = [d.likeCount, d.location, d.content, d.photoURL, d.userID, d.date, d.eventID, d.groupID, d.trendID];
        }
        else if (isCommentCsv) {
            query = "INSERT INTO comment (userID, content, numLikes, date, postID) VALUES (?)";
            input = [d.userID, d.content, d.numLikes, d.date, d.postID]
        }

        try {
            await con.query(query, [input]);
            insertedRows++;
        }
        catch (err) {
            return err.message;
        }
    }))

    const errors = results.filter(result => result !== undefined);
    res.render("import", { insertedRows, errors});
})

app.get("/users", async (req, res) => {
    const [users] = await con.query("SELECT * FROM user");
    const [posts] = await con.query("SELECT * FROM post");

    res.render("users", { users, posts });
})

app.get("/posts", async (req, res) => {
    const [posts] = await con.query("SELECT * FROM post");
    const [comments] = await con.query("SELECT * FROM comment");

    res.render("posts", { posts, comments });
})

app.get("/comments", async (req, res) => {
    const [comments] = await con.query("SELECT * FROM comment");
    const [users] = await con.query("SELECT * FROM user");

    res.render("comments", { comments, users });
})

app.listen(3000, function() {
    console.log('App listening on port 3000!');
});