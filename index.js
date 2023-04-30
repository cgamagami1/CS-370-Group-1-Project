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
    res.render("import", { insertedRows: 0, updatedRows: 0, errors: [] });
});


app.post("/import", async (req, res) => {
    const isUserCsv = Boolean(req.files?.users_csv);
    const isPostCsv = Boolean(req.files?.posts_csv);
    const isCommentCsv = Boolean(req.files?.comments_csv);

    if (!isUserCsv && !isPostCsv && !isCommentCsv) {
        res.render("import", { insertedRows: 0, updatedRows: 0, errors: ["No CSV has been uploaded"] });
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
    let updatedRows = 0;

    const results = await Promise.all(data.map(async d => {
        let query = "";
        let input = [];
        let existingID = null;
        
        if (isUserCsv) {
            const [user] = await con.query("SELECT userID FROM user WHERE fName = ? AND mInitial = ? AND lName = ?", [d.fName, d.mInitial, d.lName]);
            
            if (user.length > 0) {
                query = "UPDATE user SET ? WHERE userID = ?";
                input = { mInitial: d.mInitial, fName: d.fName, lName: d.lName, biography: d.biography, location: d.location, birthday: d.birthday};
                existingID = user[0].userID;
            }
            else {
                query = "INSERT INTO user (mInitial, fName, lName, biography, location, birthday) VALUES (?)";
                input = [d.mInitial, d.fName, d.lName, d.biography, d.location, d.birthday];
            }
        }
        else if (isPostCsv) {
            const [post] = await con.query("SELECT postID FROM post WHERE userID = ? AND content = ?", [d.userID, d.content]);

            if (post.length > 0) {
                query = "UPDATE post SET ? WHERE postID = ?";
                input = { likeCount: d.likeCount, location: d.location, content: d.content, photoURL: d.photoURL, userID: d.userID, date: d.date, eventID: d.eventID, groupID: d.groupID, trendID: d.trendID };
                existingID = post[0].postID
            }
            else {
                query = "INSERT INTO post (likeCount, location, content, photoURL, userID, date, eventID, groupID, trendID) VALUES (?)";
                input = [d.likeCount, d.location, d.content, d.photoURL, d.userID, d.date, d.eventID, d.groupID, d.trendID];
            }
        }
        else if (isCommentCsv) {
            const [comment] = await con.query("SELECT commentID FROM comment WHERE userID = ? AND content = ?", [d.userID, d.content]);

            if (comment.length > 0) {
                query = "UPDATE comment SET ? WHERE commentID = ?";
                input = { userID: d.userID, content: d.content, numLikes: d.numLikes, date: d.date, postID: d.postID };
                existingID = comment[0].commentID;
            }
            else {
                query = "INSERT INTO comment (userID, content, numLikes, date, postID) VALUES (?)";
                input = [d.userID, d.content, d.numLikes, d.date, d.postID];
            }
        }

        try {
            if (existingID === null) {
                await con.query(query, [input]);
                insertedRows++;
            }
            else {
                await con.query(query, [input, existingID]);
                updatedRows++;
            }
        }
        catch (err) {
            return err.message;
        }
    }))

    const errors = results.filter(result => result !== undefined);
    res.render("import", { insertedRows, updatedRows, errors});
})

app.get("/users", async (req, res) => {
    const [results] = await con.query(
        "SELECT user.userID, user.fName, user.mInitial, user.lName, user.biography, user.location AS userLocation, user.birthday, " + 
        "post.postID, post.likeCount, post.content, post.photoURL, post.date, post.location AS postLocation " + 
        "FROM user LEFT JOIN post ON user.userID = post.userID"
    );

    res.render("users", { results });
})

app.get("/posts", async (req, res) => {
    const [results] = await con.query(
        "SELECT postUser.fName AS postFName, postUser.mInitial AS postMInitial, postUser.lName AS postLName, " +
        "commentUser.fName AS commentFName, commentUser.mInitial AS commentMInitial, commentUser.lName AS commentLName, " +
        "post.postID, post.likeCount, post.content AS postContent, post.photoURL, post.date AS postDate, post.location, " +
        "comment.commentID, comment.userID, comment.content AS commentContent, comment.date AS commentDate, comment.numLikes " +
        "FROM post LEFT JOIN comment " +
        "ON post.postID = comment.postID " +
        "INNER JOIN user postUser " +
        "ON postUser.userID = post.userID " +
        "LEFT JOIN user commentUser " +
        "ON commentUser.userID = comment.userID"
    );

    res.render("posts", { results });
})

app.get("/comments", async (req, res) => {
    const [results] = await con.query(
        "SELECT user.userID, user.fName, user.mInitial, user.lName, user.biography, user.location AS userLocation, user.birthday, " +
        "post.postID, post.likeCount, post.content AS postContent, post.photoURL, post.date AS postDate, post.location, " +
        "comment.commentID, comment.userID, comment.content AS commentContent, comment.date AS commentDate, comment.numLikes " + 
        "FROM comment INNER JOIN user ON user.userID = comment.userID INNER JOIN post ON post.postID = comment.postID"
    );

    res.render("comments", { results });
})

app.listen(3000, function() {
    console.log('App listening on port 3000!');
});