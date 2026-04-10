const mongoose = require("mongoose");

let isConnected = false;
let connectPromise = null;

async function connectToDatabase() {
  if (isConnected) {
    return mongoose.connection;
  }

  if (connectPromise) {
    return connectPromise;
  }

  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/spendsense";

  connectPromise = mongoose
    .connect(mongoUri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 3000,
      connectTimeoutMS: 3000,
    })
    .then((mongooseInstance) => {
      isConnected = true;
      return mongooseInstance.connection;
    })
    .finally(() => {
      connectPromise = null;
    });

  return connectPromise;
}

module.exports = { connectToDatabase };
