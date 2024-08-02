const mongoose = require("mongoose");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: "2mb" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

mongoose
  .connect(process.env.MONGO_DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.log("Error connecting to database", err);
  });

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

const userModel = require("./models/userModel");
const productModel = require("./models/productModel");
const wishlistModel = require("./models/wishlistModel");
const orderModel = require("./models/orderModel");
const cartModel = require("./models/cartModel");

//endpoint to register user

const sendVerificationEmail = async (email, verificationToken) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASSWORD,
    },
  });

  const mailOptions = {
    from: "drop-store.me",
    to: email,
    subject: "Verify your email address",
    html: `<h1>Greetings from Dropstore.</h1><p>Thank you for registering your email in Dropstore. OTP to verify your account is ${verificationToken}</p>`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.log("Error sending verification email", err);
    // res.status(500).json({ message: "Error sending verification email" });
  }
};

app.post("/register", async (req, res) => {
  try {
    const { name, profilePic, email, password } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Please provide your name." });
    }
    if (!email) {
      return res.status(400).json({ message: "Email is required!" });
    }
    if (!password) {
      return res.status(400).json({ message: "Please provide a password." });
    }

    const userExists = await userModel.findOne({ email });

    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    const newUser = new userModel({
      name,
      email,
      password,
      profilePic,
    });

    newUser.verificationToken = Math.random().toString(6).substring(2, 8);

    await newUser.save();

    sendVerificationEmail(newUser.email, newUser.verificationToken);

    res.status(200).json({ message: "Registration successful!" });
  } catch (err) {
    console.log("Error registering user.", err);
    res.status(500).json({ message: "Registration Failed." });
  }
});

//endpoint to verify otp

app.get("/verify/:token", async (req, res) => {
  try {
    const token = req.params.token;
    const user = await userModel.findOne({ verificationToken: token });

    if (!user) {
      return res.status(400).json({ message: "User not found." });
    }

    if (user.verificationToken !== token) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    user.verificationToken = undefined;
    user.verified = true;
    await user.save();
    res.status(200).json({ message: "OTP Verified" });
  } catch (err) {
    console.log("Error verifying email", err);
    res.status(500).json({ message: "Error verifying email." });
  }
});

//endpoint to send otp again

app.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await userModel.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    user.verificationToken = Math.random().toString(6).substring(2, 8);

    await user.save();

    sendVerificationEmail(user.email, user.verificationToken);

    res.status(200).json({ message: "OTP sent successfully!" });
  } catch (err) {
    console.log("Error sending OTP", err);
    res.status(500).json({ message: "Error sending OTP" });
  }
});

//endpoint to login user

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await userModel.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (!user.verified) {
      return res.status(400).json({ message: "User not verified" });
    }

    if (user.password !== password) {
      return res.status(400).json({ message: "Invalid Password" });
    }

    const token = jwt.sign({ email }, process.env.SECRET_KEY);

    res.status(200).json({ message: "Login successful", token });
  } catch (err) {
    console.log("Error logging in", err);
    res.status(500).json({ message: "Error logging in" });
  }
});

//endpoint to get user details

app.get("/user", async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const decoded = jwt.verify(token, process.env.SECRET_KEY);

    const user = await userModel.findOne({ email: decoded.email });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (err) {
    console.log("Error getting user details", err);
    res.status(500).json({ message: "Error getting user details" });
  }
});

//endpoint to get horizontal products

app.post("/horizontal-products", async (req, res) => {
  try {
    const category = req?.body?.category || req?.query?.category;

    const products = await productModel
      .find({ category })
      .sort({ timeStamp: -1 })
      .limit(10);

    res.status(200).json({ products });
  } catch (err) {
    console.log("Error getting horizontal products", err);
    res.status(500).json({ message: "Error getting horizontal products" });
  }
});

//endpoint to fetch category products

app.get("/category-products/:category", async (req, res) => {
  try {
    const categoryName = req.params.category;

    const products = await productModel.find({ category: categoryName });

    res.status(200).json(products);
  } catch (err) {
    console.log("Error getting category products", err);
    res.status(500).json({ message: "Error getting category products" });
  }
});

//endpoint to fetch product details

app.get("/product-details/:productId", async (req, res) => {
  try {
    const productId = req.params.productId;

    const product = await productModel.findOne({ _id: productId });

    if (!product) {
      return res.status(400).json({ message: "Product not found" });
    }

    res.status(200).json(product);
  } catch (err) {
    console.log("Error getting product details", err);
    res.status(500).json({ message: "Error getting product details" });
  }
});

//endpoint to add product to wishlist
app.post("/add-to-wishlist", async (req, res) => {
  try {
    const { productId, userId } = req.body;

    const product = await productModel.findOne({ _id: productId });

    if (!product) {
      return res.status(400).json({ message: "Product not found" });
    }

    const wishlist = new wishlistModel({
      productId,
      userId,
    });

    await wishlist.save();

    res.status(200).json({ message: "Product added to wishlist" });
  } catch (err) {
    console.log("Error adding product to wishlist", err);
    res.status(500).json({ message: "Error adding product to wishlist" });
  }
});

//endpoint to remove product from wishlist
app.post("/remove-from-wishlist", async (req, res) => {
  try {
    const { productId, userId } = req.body;

    const product = await wishlistModel.findOne({ productId, userId });

    if (!product) {
      return res.status(400).json({ message: "Product not found in wishlist" });
    }

    await wishlistModel.deleteOne({ productId });

    res.status(200).json({ message: "Product removed from wishlist" });
  } catch (err) {
    console.log("Error removing product from wishlist", err);
    res.status(500).json({ message: "Error removing product from wishlist" });
  }
});

//endpoint to fetch wishlist
app.get("/wishlist/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const wishlist = await wishlistModel
      .find({ userId })
      .sort({ timeStamp: -1 });

    const products = [];

    for (let i = 0; i < wishlist.length; i++) {
      const product = await productModel.findOne({
        _id: wishlist[i].productId,
      });
      products.push(product);
    }

    res.status(200).json(products);
  } catch (err) {
    console.log("Error fetching wishlist", err);
    res.status(500).json({ message: "Error fetching wishlist" });
  }
});

//endpoint to check wishlist
app.post("/check-wishlist", async (req, res) => {
  try {
    const { productId, userId } = req.body;
    const product = await wishlistModel.findOne({
      productId,
      userId,
    });
    if (product) {
      res.status(200).json({ inWishlist: true });
    } else {
      res.status(200).json({ inWishlist: false });
    }
  } catch (err) {
    console.log("Error checking wishlist", err);
    res.status(500).json({ message: "Error checking wishlist" });
  }
});

//endpoint to add address
app.post("/add-address", async (req, res) => {
  try {
    const { userId, name, street, landmark, houseNo, postalCode, mobileNo } =
      req.body;

    if (!name) {
      return res.status(400).json({ message: "Please provide your name." });
    }

    if (!street) {
      return res
        .status(400)
        .json({ message: "Please provide your street address." });
    }

    if (!landmark) {
      return res.status(400).json({ message: "Please provide your landmark." });
    }

    if (!postalCode) {
      return res
        .status(400)
        .json({ message: "Please provide your postal code." });
    }

    if (!mobileNo) {
      return res
        .status(400)
        .json({ message: "Please provide your mobile number." });
    }

    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    user.addresses.push({
      name,
      street,
      landmark,
      houseNo,
      postalCode,
      mobileNo,
    });

    await user.save();

    res.status(200).json({ message: "Address added successfully" });
  } catch (err) {
    console.log("Error adding address", err);
    res.status(500).json({ message: "Error adding address" });
  }
});

//endpoint to get user addresses
app.get("/addresses/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    res.status(200).json(user.addresses);
  } catch (err) {
    console.log("Error getting addresses", err);
    res.status(500).json({ message: "Error getting addresses" });
  }
});

//endpoint to delete address
app.post("/delete-address", async (req, res) => {
  try {
    const { userId, addressId } = req.body;

    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    user.addresses = user.addresses.filter(
      (address) => address._id.toString() !== addressId
    );

    await user.save();

    res.status(200).json({ message: "Address deleted successfully" });
  } catch (err) {
    console.log("Error deleting address", err);
    res.status(500).json({ message: "Error deleting address" });
  }
});

//endpoint to get all order
app.get("/all-orders/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    if (userId) {
      const orders = await orderModel
        .find({ user: userId })
        .sort({ timeStamp: -1 });

      res.status(200).json(orders);
    }
  } catch (err) {
    console.log("Error fetching orders", err);
    res.status(500).json({ message: "Error fetching orders" });
  }
});

//endpoint to add product to cart
app.post("/add-to-cart", async (req, res) => {
  try {
    const { userId, productId } = req.body;
    console.log("UserId", userId);
    const product = await productModel.findOne({
      _id: productId,
    });

    if (!product) {
      return res.status(400).json({ message: "Product not found" });
    }

    const cart = new cartModel({
      userId,
      productId,
    });

    await cart.save();

    res.status(200).json({ message: "Product added to cart" });
  } catch (err) {
    console.log("Error adding product to cart", err);
    res.status(500).json({ message: "Error adding product to cart" });
  }
});

//endpoint to remove product from cart
app.post("/remove-from-cart", async (req, res) => {
  try {
    const { userId, productId } = req.body;

    const product = await cartModel.findOne({ productId, userId });

    if (!product) {
      return res.status(400).json({ message: "Product not found in cart" });
    }

    await cartModel.deleteOne({ productId });

    res.status(200).json({ message: "Product removed from cart" });
  } catch (err) {
    console.log("Error removing product from cart", err);
    res.status(500).json({ message: "Error removing product from cart" });
  }
});

//endpoint to fetch cart
app.post("/cart", async (req, res) => {
  try {
    const { userId } = req.body;

    const cart = await cartModel.find({ userId }).populate("productId");

    const products = [];

    for (let i = 0; i < cart.length; i++) {
      const product = await productModel.findOne({ _id: cart[i].productId });
      products.push(product);
    }

    res.status(200).json(cart);
  } catch (err) {
    console.log("Error fetching cart", err);
    res.status(500).json({ message: "Error fetching cart" });
  }
});

//endpoint to cancel order
app.post("/cancel-order", async (req, res) => {
  try {
    const { orderId } = req.body;
    console.log(orderId);

    const order = await orderModel.findOne({ _id: orderId });

    if (!order) {
      return res.status(400).json({ message: "Order not found" });
    } else if (order.status === "cancelled") {
      return res.status(400).json({ message: "Order already cancelled" });
    }

    order.cancelled = true;

    await order.save();

    res.status(200).json({ message: "Order cancelled successfully" });
  } catch (err) {
    console.log("Error cancelling order", err);
    res.status(500).json({ message: "Error cancelling order" });
  }
});

//endpoint to change user details
app.post("/edit-user", async (req, res) => {
  try {
    const { userId, name, profilePic } = req.body;

    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    if (name.length === 0) {
      return res.status(400).json({ message: "Name cannot be empty" });
    }

    user.name = name;
    user.profilePic = profilePic;

    await user.save();

    res.status(200).json({ message: "User details updated successfully" });
  } catch (err) {
    console.log("Error editing user details", err);
    res.status(500).json({ message: "Error editing user details" });
  }
});

//endpoint to remove product from cart
// app.post("/remove-from-cart", async (req, res) => {
//   try {
//     const { userId, productId } = req.body;

//     const product = await cartModel.findOne({ productId, userId });

//     if (!product) {
//       return res.status(400).json({ message: "Product not found in cart" });
//     }

//     await cartModel.deleteOne({ productId });

//     res.status(200).json({ message: "Product removed from cart" });
//   } catch (err) {
//     console.log("Error removing product from cart", err);
//     res.status(500).json({ message: "Error removing product from cart" });
//   }
// });

//endpoint to increase quantity of product in cart
app.post("/increase-qty", async (req, res) => {
  try {
    const { userId, productId } = req.body;

    const product = await cartModel.findOne({
      userId: userId,
      _id: productId,
    });

    if (!product) {
      console.log("Product not found in cart");
      return res.status(400).json({ message: "Product not found in cart" });
    }

    product.quantity += 1;

    await product.save();

    res.status(200).json({ message: "Quantity increased successfully" });
  } catch (err) {
    console.log("Error increasing quantity", err);
    res.status(500).json({ message: "Error increasing quantity" });
  }
});

//endpoint to decrease quantity of product in cart
app.post("/decrease-qty", async (req, res) => {
  try {
    const { userId, productId } = req.body;

    const product = await cartModel.findOne({ userId: userId, _id: productId });

    if (!product) {
      return res.status(400).json({ message: "Product not found in cart" });
    }

    product.quantity -= 1;

    if (product.quantity === 0) {
      await cartModel.deleteOne({ userId });
      return res.status(200).json({ message: "Product removed from cart" });
    }

    await product.save();

    res.status(200).json({ message: "Quantity decreased successfully" });
  } catch (err) {
    console.log("Error decreasing quantity", err);
    res.status(500).json({ message: "Error decreasing quantity" });
  }
});

//endpoint to check product in cart
app.post("/check-cart", async (req, res) => {
  try {
    const { productId, userId } = req.body;

    const product = await cartModel.findOne({ productId, userId });

    if (product) {
      res.status(200).json({ inCart: true });
    } else {
      res.status(200).json({ inCart: false });
    }
  } catch (err) {
    console.log("Error checking cart", err);
    res.status(500).json({ message: "Error checking cart" });
  }
});

//endpoint to search products
app.get("/search", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ message: "Query parameter is required" });
    }

    const searchCriteria = {
      $or: [
        { productName: { $regex: query, $options: "i" } },
        { brandName: { $regex: query, $options: "i" } },
        { category: { $regex: query, $options: "i" } },
      ],
    };

    const products = await productModel.find(searchCriteria);

    res.json({ products });
  } catch (error) {
    console.error("Error searching for products:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//endpoint to order products
app.post("/place-order", async (req, res) => {
  try {
    const { userId, products, shippingAddress, totalPrice, paymentMethod } =
      req.body;

    const user = await userModel.findById(userId);

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const order = new orderModel({
      user: userId,
      products,
      totalPrice,
      shippingAddress,
      paymentMethod,
    });

    await order.save();

    res.status(200).json({ message: "Order placed successfully" });
  } catch (err) {
    console.log("Error ordering products", err);
    res.status(500).json({ message: "Error ordering products" });
  }
});

//endpoint to clear cart
app.post("/clear-cart", async (req, res) => {
  try {
    const { userId } = req.body;

    const cart = await cartModel.deleteMany({ userId });

    res.status(200).json({ message: "Cart cleared successfully" });
  } catch (err) {
    console.log("Error clearing cart", err);
    res.status(500).json({ message: "Error clearing cart" });
  }
});

//endpoint to send forgot password email
app.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await userModel.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const resetToken = Math.random().toString(6).substring(2, 8);

    user.resetToken = resetToken;

    await user.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
      },
    });

    const mailOptions = {
      from: "drop-store.me",
      to: email,
      subject: "Reset your password",
      html: `<h1>Greetings from Dropstore.</h1><p>OTP to reset your password is ${resetToken}</p>`,
    };

    await transporter.sendMail(mailOptions);

    res
      .status(200)
      .json({ message: "Forgot password email sent successfully" });
  } catch (err) {
    console.log("Error sending forgot password email", err);
    res.status(500).json({ message: "Error sending forgot password email" });
  }
});

//endpoint to verify reset password otp
app.post("/verify-reset-pass-otp", async (req, res) => {
  try {
    const { otp } = req.body;
    const user = await userModel.findOne({ resetToken: otp });

    if (!user) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.resetToken !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    res.status(200).json({ message: "OTP verified successfully" });
  } catch (err) {
    console.log("Error verifying OTP", err);
    res.status(500).json({ message: "Error verifying OTP" });
  }
});

//endpoint to reset password
app.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, password } = req.body;

    const user = await userModel.findOne({
      email,
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    user.password = password;
    user.resetToken = undefined;

    await user.save();

    res.status(200).json({ message: "Password reset successfully" });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
      },
    });

    const mailOptions = {
      from: "drop-store.me",
      to: email,
      subject: "Password reset successful",
      html: `<h1>Greetings from Dropstore.</h1><p>Your password has been reset successfully.</p>`,
    };

    await transporter.sendMail(mailOptions);
  } catch (err) {
    console.log("Error resetting password", err);
    res.status(500).json({ message: "Error resetting password" });
  }
});
