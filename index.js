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


    app.get("/users", async (req, res) => {
      if (req?.query?.email) {
        const query = { email: req.query?.email };
        const user = await usersCollection.findOne(query);
        if (user?.classesId) {
          const classIds = user.classesId?.map(id => new ObjectId(id)); // Convert string IDs to ObjectId
          const classesData = await classesCollection.find({ _id: { $in: classIds } }).toArray();
          return res.send(classesData);
        }
        else if (!user?.classesId) {
          return res.send({ error: "No classes found" });
        } 
        else {
          return res.status(404).send({ error: "User not found" });
        }
      }

      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    app.get("/users/instructors", async (req, res) => {
      const query = { role: "instructor" }
      const result = await usersCollection.find(query).sort({ classesTaken: -1 }).toArray();
      res.send(result)
    })

    app.get("/classes", async (req, res) => {
      if (req?.query?.email) {

      }
      const result = await classesCollection.find().toArray();
      res.send(result);
    })


    app.get('/users/admin/:email', async (req, res) => {
      // console.log(req.params);
      if (req.params?.email) {
        const email = req.params?.email;
        // console.log(email);
        const query = { email: email }
        const user = await usersCollection.findOne(query);
        // const result = { isAdmin: user?.role === "admin" }
        // console.log(user);
        if (!user) {
          return res.send({ isAdmin: false, role: "student" })
        }
        return res.send({ "isAdmin": user.isAdmin, "role": user.role });
      }
      if (!req.params?.email) {
        return res.send({ isAdmin: false, role: null })

      }
    })


    app.post("/users", async (req, res) => {
      const body = req.body;
      const query = { email: body.email }
      const user = usersCollection.findOne(query);
      console.log(query, user);
      if (!user) {
        const result = await usersCollection.insertOne(body);
       return res.send(result);
      } 
      else{
        return res.send({message: "user exist"})
      }
    })


    app.post("/classes", async (req, res) => {
      const body = req.body;
      // console.log(body);
      const result = await classesCollection.insertOne(body);
      // console.log(result);
      res.send(result);
    })



    // Update operation 
    app.put("/users", async (req, res) => {
      let query = {};
      if (req?.query?.email) {
        query = req.query.email;
        const body = req.body;
        // console.log(query);
        // console.log(body);
        const filter = { email: query };
        const options = { upsert: true };
        const user = await usersCollection.findOne(filter);
        if (body?.classId) {
          if (user?.classesId && user?.classesId?.includes(body.classId)) {
            // if ClassId already exists in the array
            return res.send({ error: "ClassId already exists in the array." });
          }
          else {
            const update = { $addToSet: { classesId: body.classId } };
            const result = await usersCollection.updateOne(filter, update, options);
            const classFilter = { _id: new ObjectId(body?.classId) };
            const classAfterFilter = await classesCollection.findOne(classFilter);
            const updateAvailableSeat = (+classAfterFilter?.availableSeat || +classAfterFilter?.capacity) - 1; //for converting integer and increasing value
            const classUpdate = { $set: { availableSeat: updateAvailableSeat } }; // for reconvert in string formate
            const classResult = await classesCollection.updateOne(classFilter, classUpdate);

            return res.send({ userResult: result, classResult });
          }
        }
        if (body?.classes) {
          const update = { $push: { classes: body.classes } };
          const result = await usersCollection.updateOne(filter, update, options);
          return res.send(result);
        }
        const updateUser = {
          $set: {
            ...body
          },
        };
        const result = await usersCollection.updateOne(filter, updateUser, options);
        // console.log(result);
        res.send(result);

      }
    });

    // Update class data 
    app.put("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      console.log("hitting");
      // console.log(req.body, id);
      const query = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const updatedClass = {
        $set: {
          ...body
        }
      }
      const result = await classesCollection.updateOne(query, updatedClass, options);
      res.send(result)
    })

    //Delete my class
    app.delete("/users", async (req, res) => {
      if (req?.query?.email && req?.query?.id) {
        const query = { email: req.query?.email };
        const id = req.query.id;
        // console.log(req.query.email, id);
        const user = await usersCollection.findOne(query);
        if (user?.classesId) {
          const classIdToDelete = id;
          // setting updated classId by filter 
          const updatedClassesId = user.classesId.filter(classId => classId !== classIdToDelete);
          const updatedUser = {
            $set: {
              classesId: updatedClassesId
            }
          }
          const result = await usersCollection.updateOne(query, updatedUser);
          res.send(result);
        }
      }
    })


    // delete users operations 
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    })

    // delete class operations
    app.delete("/classes/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) };
      const result = await classesCollection.deleteOne(query);
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