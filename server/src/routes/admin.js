const express = require("express");
const auth = require("../auth");

const router = express.Router();
router.use(auth.requireAdmin);

router.get("/officers", (req, res) => {
  res.render("admin/officers", { user: req.user, active: "admin" });
});

module.exports = router;
