//server routes to handle get and post requests
const { upload, getDetails, streamVerification, changeVisibility, stream, getVideos, getThumbs, download, deleteVideo } = require("../controllers/mediaControllers");
const router = require("express").Router();
router.post("/upload", upload);
router.get("/stream/:url", stream);
router.post("/getDetails", getDetails);
router.post("/streamVerification", streamVerification);
router.post("/changeVisibility", changeVisibility);
router.post("/getVideos", getVideos);
router.post("/download", download);
router.post("/delete", deleteVideo);
router.get("/getThumbs/:videoId", getThumbs);
module.exports = router;