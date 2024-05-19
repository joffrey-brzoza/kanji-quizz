

import express from 'express';
import cors from 'cors';
import { MongoClient, ServerApiVersion } from "mongodb";

const app = express();
const port = process.env.PORT || 9000;

app.use(express.json());
app.use(cors())

const uri = "mongodb+srv://admin:jo13br10@cluster0.7qjoc.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function nextQuestion(level) {
    let output = []
    const database = client.db("kanjiquizzdb");
    const questions = database.collection("questions");
    const cursor = questions.aggregate([{$match: {serie: level}}, {$sample: {size: 4}}]);
    await cursor.forEach(item => {
        output.push(item);
    });
    return (output);
}

async function searchKanji(search, live) {
    let output = [];
    const database = client.db("kanjiquizzdb");
    const questions = database.collection("questions");
    const cursor = questions.find(
        { $and : 
            [   {serie: live ? 1 : 0}, 
                {$or: [
                    {kanji: {$regex: new RegExp(search, "i")}},
                    {hiragana: {$regex: new RegExp(search, "i")}},
                    {definition: {$regex: new RegExp(search, "i")}}
                ]}
            ]
        })
    await cursor.forEach(item => {
        output.push(item);
    });
    return (output);
}

async function searchAllKanji() {
    let output = [];
    const database = client.db("kanjiquizzdb");
    const questions = database.collection("questions");
    const cursor = questions.find({}).sort({serie:-1})
    await cursor.forEach(item => {
        output.push(item);
    });
    console.log(output.length);
    return (output);
}

async function findKanji(search) {
    const database = client.db("kanjiquizzdb");
    const questions = database.collection("questions");
    const kanji = await questions.findOne({ kanji: search })
    console.log("Result of findKanji : ", kanji)
    return (kanji);
}

async function getScore() {
    const database = client.db("kanjiquizzdb");
    const scores = database.collection("scores");
    var d = new Date(new Date().toUTCString());
    d.setHours(0, 0, 0, 0);
    let score = scores.findOne({date: d}, (err, data) => {
        if (err) {
            console.log("Error in getScore " + err);
            return false
        } else {
            return data
        }
    });
    return (score);
}

async function getAllScores() {
    var output = []
    const database = client.db("kanjiquizzdb");
    const scores = database.collection("scores");
    let cursor = scores.find({}).sort({date:-1}) ;
    await cursor.forEach(item => {
        output.push(item);
    });
    return (output);
}


async function addQuestion(kanji) {
    console.log("In addQuestion with kanji = ", kanji)
    const database = client.db("kanjiquizzdb");
    const questions = database.collection("questions");
    let addedQuestion = await questions.insertOne(kanji);
    console.log(addedQuestion)
    return addedQuestion.acknowledged;
}

async function updateQuestion(kanji) {
    const database = client.db("kanjiquizzdb");
    const questions = database.collection("questions");
    if (kanji._id) delete kanji._id;
    let updatedQuestion = await questions.updateOne({kanji:kanji.kanji},{$set : kanji}, {upsert: false, returnDocument: "after", returnNewDocument: true});
    return updatedQuestion.modifiedCount;
}

async function deleteQuestion(kanji) {
    console.log("In deleteQuestion with kanji = ", kanji)
    const database = client.db("kanjiquizzdb");
    const questions = database.collection("questions");
    let deletedQuestion = await questions.deleteOne({kanji:kanji.kanji});
    console.log("deletedQuestion : ", deletedQuestion)
    return deletedQuestion.deletedCount;
}


async function updateScore(updatedValue) {
    console.log("updatedValue = ", updatedValue)
    const database = client.db("kanjiquizzdb");
    const scores = database.collection("scores");
    var d = new Date(new Date().toUTCString());
    d.setHours(0, 0, 0, 0);
    console.log("Date to Search = ", d)
    let updatedObject = await scores.findOneAndUpdate({date: d}, {$inc: {score: updatedValue}}, {upsert: true, returnDocument: "after", returnNewDocument: true});
    console.log(updatedObject)
    return updatedObject;
}

async function updateQuestionScore(kanji) {
    console.log("kanji = ", kanji)
    const database = client.db("kanjiquizzdb");
    const questions = database.collection("questions");
    let updatedObject = await questions.findOneAndUpdate({kanji: kanji}, {$inc: {score: 1}}, {returnDocument: "after", returnNewDocument: true});
    console.log(updatedObject.value)
    return updatedObject.value;
}

app.post('/getQuestion', async (req, res) => {
    let body = req.body;
    const level = body.level;
    const listOfQuestion = await nextQuestion(level);
    res.status(200).json(listOfQuestion);
});

app.get('/getQuestion', async (req, res) => {
    //let body = req.body;
    const level = 1;
    const listOfQuestion = await nextQuestion(level);
    res.status(200).json(listOfQuestion);
});

app.post('/search', async (req, res) => {
    let body = req.body;
    const search = body.search;
    const live = body.live;
    const searchResult = await searchKanji(search, live);
    res.status(200).json(searchResult);
});

app.post('/searchAllKanji', async (req, res) => {
    const searchResult = await searchAllKanji();
    res.status(200).json(searchResult);
});

app.post('/findKanji', async (req, res) => {
    let body = req.body;
    const search = body.search;
    const searchResult = await findKanji(search);
    if (searchResult) {
        res.status(200).json(searchResult);
    } else {
        res.status(204).send()
    }
});


app.get('/getDate', async (req, res) => {
    var dUTC = new Date(new Date().toUTCString());
    var dLocal = new Date();
    res.status(200).send("dUTC = " + dUTC + " dlocal = " + dLocal);
});

app.get('/getScore', async (req, res) => {
    const score = await getScore();
    res.status(200).json(score);
});

app.get('/getAllScores', async (req, res) => {
    const allScores = await getAllScores();
    res.status(200).json(allScores);
});

app.post('/updateScore', async (req, res) => {
    let body = req.body;
    const updatedValue = body.score;
    const updatedScore = await updateScore(updatedValue);
    if (updateScore)
        res.status(200).json(updatedScore.value);
    else
        res.status(500).send();
});

app.post('/updateQuestionScore', async (req, res) => {
    let body = req.body;
    const kanji = body.kanji;
    const updatedQuestion = await updateQuestionScore(kanji);
    if (updatedQuestion)
        res.status(200).json(updatedQuestion);
    else
        res.status(500).send();
});

app.post('/addQuestion', async (req, res) => {
    let body = req.body;
    const kanji = body;
    const addedQuestion = await addQuestion(kanji);
    if (addedQuestion)
        res.status(200).json(addedQuestion);
    else
        res.status(500).send();
});

app.post('/updateQuestion', async (req, res) => {
    let body = req.body;
    const kanji = body;
    const updatedQuestion = await updateQuestion(kanji);
    console.log("Return ", updatedQuestion, updatedQuestion == true)
    if (updatedQuestion >= 0)
        res.status(200).json(updatedQuestion);
    else
        res.status(200).send();
});

app.post('/deleteQuestion', async (req, res) => {
    let body = req.body;
    const kanji = body;
    const deletedQuestion = await deleteQuestion(kanji);
    if (deletedQuestion > 0)
        res.status(200).json(deletedQuestion);
    else
        res.status(500).send();
});

// OUTPUT
app.listen(port, () => {
    console.log(`listening on localhost:${port}`)
});
