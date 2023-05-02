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

const importUser = async ({ fName, lName, mInitial, biography, location, birthday }) => {
    const [user] = await con.query("SELECT userID FROM user WHERE fName = ? AND mInitial = ? AND lName = ?", [fName, mInitial, lName]);
    
    try {
        if (user.length > 0) {
            await con.query(
                "UPDATE user SET ? WHERE userID = ?", 
                [{ fName, lName, mInitial, biography, location, birthday }, user[0].userID]
            );
            return { inserted: false, updated: true, error: null };
        }
        else {
            await con.query(
                "INSERT INTO user (mInitial, fName, lName, biography, location, birthday) VALUES (?)", 
                [[mInitial, fName, lName, biography, location, birthday]]
            );
            return { inserted: true, updated: false, error: null };
        }
    }
    catch (err) {
        return { inserted: false, updated: false, error: err.message };
    }
}

const importPost = async ({ likeCount, location, content, photoURL, userID, date, eventID, groupID, trendID }) => {
    const [post] = await con.query("SELECT postID FROM post WHERE userID = ? AND content = ?", [userID, content]);

    try {
        if (post.length > 0) {
            await con.query(
                "UPDATE post SET ? WHERE postID = ?",
                [{ likeCount, location, content, photoURL, userID, date, eventID, groupID, trendID }, post[0].postID]
            );
            return { inserted: false, updated: true, error: null };
        }
        else {
            await con.query(
                "INSERT INTO post (likeCount, location, content, photoURL, userID, date, eventID, groupID, trendID) VALUES (?)",
                [[likeCount, location, content, photoURL, userID, date, eventID, groupID, trendID]]
            );
            return { inserted: true, updated: false, error: null };
        }
    }
    catch (err) {
        return { inserted: false, updated: false, error: err.message };
    }
}

const importComment = async ({ userID, content, numLikes, date, postID }) => {
    const [comment] = await con.query("SELECT commentID FROM comment WHERE userID = ? AND content = ? AND postID = ?", [userID, content, postID]);

    try {
        if (comment.length > 0) {
            await con.query(
                "UPDATE comment SET ? WHERE commentID = ?",
                [{ userID, content, numLikes, date, postID }, comment[0].commentID]
            );
            return { inserted: false, updated: true, error: null };
        }
        else {
            await con.query(
                "INSERT INTO comment (userID, content, numLikes, date, postID) VALUES (?)",
                [[userID, content, numLikes, date, postID]]
            );
            return { inserted: true, updated: false, error: null };
        }
    }
    catch (err) {
        return { inserted: false, updated: false, error: err.message };
    }
}

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

    const results = await Promise.all(data.map(async d => {     
        if (isUserCsv) {
            return await importUser(d);
        }
        else if (isPostCsv) {
            return await importPost(d);
        }
        else if (isCommentCsv) {
            return await importComment(d);
        }
    }))

    const insertedRows = results.reduce((acc, result) => result.inserted ? acc + 1 : acc, 0);
    const updatedRows = results.reduce((acc, result) => result.updated ? acc + 1 : acc, 0);
    const errors = results.filter(result => result.error !== null).map(result => result.error);
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