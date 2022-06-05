const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

const jwt = require("jsonwebtoken");
const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4lurm.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// Verify jwt
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).send({ message: "UnAuthorized Access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      res.status(403).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    console.log("DB Connected");

    // Products Collection
    const productsCollection = client.db("saw-center").collection("products");

    // All the user collection
    const userCollection = client.db("saw-center").collection("users");

    // All the reviews collection
    const reviewsCollection = client.db("saw-center").collection("reviews");

    // All the order collection
    const ordersCollection = client.db("saw-center").collection("orders");

    // Payment Collection
    const paymentCollection = client.db("saw-center").collection("payments");

    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "forbidden" });
      }
    };

    //   Get all products
    app.get("/products", async (req, res) => {
      const query = {};
      const cursor = productsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Get product by Id
    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await productsCollection.findOne(query);
      res.send(result);
    });
    // Insert a product
    app.post("/product", async (req, res) => {
      const order = req.body;
      //   console.log(order);
      const result = await productsCollection.insertOne(order);
      res.send({ success: true, result });
    });

    // Delete an product
    app.delete("/product/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });

    //   Get all reviews
    app.get("/reviews", async (req, res) => {
      const query = {};
      const cursor = reviewsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Insert review
    app.post("/review", async (req, res) => {
      const order = req.body;
      //   console.log(order);
      const result = await reviewsCollection.insertOne(order);
      res.send({ success: true, result });
    });

    // Insert order
    app.post("/order", async (req, res) => {
      const order = req.body;
      //   console.log(order);
      const result = await ordersCollection.insertOne(order);
      res.send({ success: true, result });
    });

    //   Get all order
    app.get("/all-orders", verifyJWT, async (req, res) => {
      const query = {};
      const cursor = ordersCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });
    // Get order based on email
    app.get("/orders", verifyJWT, async (req, res) => {
      const customerEmail = req.query.customerEmail;
      console.log(req);
      const decodedEmail = req.decoded.email;
      if (customerEmail === decodedEmail) {
        const query = { customerEmail: customerEmail };
        const order = await ordersCollection.find(query).toArray();
        return res.send(order);
      } else {
        return res.status(403).send({ message: "Forbidden Access" });
      }
    });
    // Get order by ID
    app.get("/order/:id", async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const query = { _id: ObjectId(id) };
      const result = await ordersCollection.findOne(query);
      console.log(result);
      res.send(result);
    });

    // Update the order after payment
    app.patch("/order/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const payment2 = req.body;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          payment: true,
          transactionId: payment2.transactionId,
        },
      };

      const result = await paymentCollection.insertOne(payment2);
      const updatedOrder = await ordersCollection.updateOne(filter, updatedDoc);
      console.log(updatedOrder);
      res.send(updatedOrder);
    });

    //Update the order shipping status after payment
    app.patch("/order-shipped/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const updatedDoc = {
        $set: {
          shipped: true

        }
      };
      const updatedOrder = await ordersCollection.updateOne(filter, updatedDoc);
      console.log(updatedOrder);
      res.send(updatedOrder);
    });

    // Delete an order
    app.delete("/order/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await ordersCollection.deleteOne(query);
      res.send(result);
    });

    // Adding user into userCollection
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1d" }
      );
      res.send({ result, token });
    });

    // To update existing user data
    app.put("/userUpdate/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);

      res.send(result);
    });

    // Get all user
    app.get("/user", verifyJWT, async (req, res) => {
      const user = await userCollection.find().toArray();
      res.send(user);
    });

    // make admin

    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // Check is a user is admin or not
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });

    // Payment
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const service = req.body;
      const price = service.totalPrice;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: price,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });
  } finally {
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World! Hi");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
