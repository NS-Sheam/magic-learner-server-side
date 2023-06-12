const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
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
    const paymentCollection = client.db("summerCampDb").collection("paymentData");


    app.get("/users", async (req, res) => {
      if (req?.query?.email) {
        const query = { email: req.query?.email };
        const user = await usersCollection.findOne(query);
        // console.log(user);
        if (user?.classesId) {
          const classIds = user.classesId?.map(idData => new ObjectId(Object.keys(idData)[0])); // Convert string IDs to ObjectId
          const classesData = await classesCollection.find({ _id: { $in: classIds } }).toArray();
          return res.send(classesData)
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
      else {
        return res.send({ message: "user exist" })
      }
    })


    app.post("/classes", async (req, res) => {
      const body = req.body;
      // console.log(body);
      const result = await classesCollection.insertOne(body);
      // console.log(result);
      res.send(result);
    })


    // Card payment intent 
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = Math.round(price * 100);;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"]
      })
      res.send({
        clientSecret: paymentIntent.client_secret
      })

    })


    // Payment api
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const email = req?.body?.email;
      const user = await usersCollection.findOne({ email: email })
      let isSuccess = true;
      // console.log(user);
      const classIds = req?.body?.classIds;
      const options = { upsert: true };
      classIds?.map(async (classId) => {
        // console.log(classId, user, email);
        const updateKey = {classId: "paymentConfirm"}
        console.log(updateKey);
        const updateUser = { $set: { classesId: { [`${classId}`] : "paymentConfirmed" } } };
        const singleClass = await classesCollection.findOne({ _id: new ObjectId(classId) });
        const updatedSingleClass = (+singleClass?.availableSeat || +singleClass?.capacity) - 1;
        const classUpdate = { $set: { availableSeat: updatedSingleClass } };
        const classResult = await classesCollection.updateOne({ _id: new ObjectId(classId) }, classUpdate);
        const userResult = await usersCollection.updateOne(user, updateUser);
        console.log( classResult, userResult);
        if (classResult.modifiedCount === 0 || userResult.modifiedCount === 0) {
          isSuccess = false;
        }
      });
      const result = await paymentCollection.insertOne(payment);
      if (isSuccess) {
        res.send({ paymentResult: result, success: true });
      }
      else {
        res.send({ paymentResult: result, success: false });
      }
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
            const update = { $addToSet: { classesId: { [body.classId]: "pending" } } };
            const result = await usersCollection.updateOne(filter, update, options);

            return res.send(result);
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
        const id = req?.query?.id;
        // console.log(req.query.email, id);
        const user = await usersCollection.findOne(query);
        if (user?.classesId) {
          const updatedClassesId = user?.classesId.filter((singleClass) => {
            const classId = Object.keys(singleClass)[0];
            return classId !== id;
          });

          const updatedUser = {
            $set: {
              classesId: updatedClassesId,
            },
          };

          const result = await usersCollection.updateOne(query, updatedUser);
          res.send(result)
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