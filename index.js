const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const instructorData = require('./instructorData.json');
const classesData = require('./classesData.json');

// middlewares
app.use(cors());
app.use(express.json());

// summerCampDb
// l69GU7e9EgvU1jM7


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.k0vsmln.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("summerCampDb").collection("users");
    const classesCollection = client.db("summerCampDb").collection("classesData");


    app.get("/users", async (req, res)=>{
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    app.get("/users/instructors", async (req, res) =>{
      const query = {role: "instructor"}
      const result = await usersCollection.find(query).sort({classesTaken: -1}).toArray();
      res.send(result)
    })
    
    app.get("/classes", async (req, res) =>{
      res.send(classesData);
    })


    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params?.email;
      // console.log(email);
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      // const result = { isAdmin: user?.role === "admin" }
      // console.log(user);
      res.send({"isAdmin": user.isAdmin, "role": user.role});
    })


    app.post("/users", async(req, res) =>{
      const body = req.body;
      const result = await usersCollection.insertOne(body);
      res.send(result);
    })
    


    // delete operations 
    app.delete("/users/:id", async(req, res) =>{
      const id = req.params.id;
      const query = {_id : new ObjectId(id)};
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get("/", (req, res) => {
  res.send("summer camp is running");
})



app.listen(port, () => {
  console.log(`Summer camp is running on port ${port}`);
})


// https://ibb.co/JRNSXFm
// https://ibb.co/Jc06GT5
// https://ibb.co/pQTD8zQ
// https://ibb.co/JmhhDsS