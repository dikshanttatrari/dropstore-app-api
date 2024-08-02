const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema({
  productId: {
    type: String,
    ref: "product",
  },
  userId: {
    type: String,
  },
  timeStamp: {
    type: Date,
    default: Date.now,
  },
});

const wishlistModel = mongoose.model("wishlist", wishlistSchema);

module.exports = wishlistModel;
