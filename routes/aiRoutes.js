const express = require("express");
const router = express.Router();
const Product = require("../models/Product");

router.post("/", async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Query is required",
      });
    }

    const cleanQuery = query
      .toLowerCase()
      .replace("i need", "")
      .replace("two", "")
      .replace("three", "")
      .trim();

    console.log("Searching for:", cleanQuery);

    const products = await Product.find({
      name: {
        $regex: cleanQuery,
        $options: "i",
      },
    }).limit(20);

    res.json({
      success: true,
      products,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

module.exports = router;