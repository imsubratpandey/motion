const { Users, Metadata, ObjectId } = require("../collections/mongoCollections");
const path = require("path");
const fs = require("fs");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
const { getVideoDurationInSeconds } = require("get-video-duration");

//upload request handler
module.exports.upload = async (req, res, next) => {
    try {
        const processingDone = async () => {
            getVideoDurationInSeconds(`${path.join(__dirname, `..`, `..`, `database`, `${videoId}.mp4`)}`).then(async (duration) => {
                if (duration == null)
                    console.log(`Error in finding length - ${videoId}`)
                console.log(duration);
                await new ffmpeg(`${path.join(__dirname, `..`, `..`, `database`, `${videoId}.mp4`)}`)
                    .takeScreenshots({
                        count: 1,
                        timemarks: [duration / 2],
                        filename: `${videoId}.png`
                    }, `${path.join(__dirname, `..`, `..`, `database`, `thumbnails`)}`, function (err) {
                        if (err)
                            console.log(`Screenshot failed - ${videoId}`);
                    });
            });
            await Metadata.updateOne({ videoId: videoId }, { $set: { processed: true } });
            console.log(`Video processing done - ${videoId}`);
        }
        if (req.files === null)
            return res.status(400).json({ status: false, msg: "No file selected" });
        const file = await req.files.file;
        console.log(file.name);
        const fileType = await file.mimetype;
        console.log(file.mimetype);
        const title = await req.body.title;
        const description = await req.body.description;
        const _id = await req.body._id;
        if (!(fileType === "video/mp4") || !(path.extname(`${file.name}`) === ".mp4"))
            return res.status(400).json({ status: false, msg: "File type is not supported" });
        if (title === "")
            return res.status(400).json({ status: false, msg: "Title or Description cannot be blank" });
        if (description === "")
            return res.status(400).json({ status: false, msg: "Title or Description cannot be blank" });
        if (title.indexOf(" ") === 0)
            return res.status(400).json({ status: false, msg: "Title cannot start with space" });
        if (description.indexOf(" ") === 0)
            return res.status(400).json({ status: false, msg: "Description cannot start with space" });
        const user = await Users.findOne({ _id: new ObjectId(_id) });
        if (!(user))
            return res.status(500).json({ status: false, msg: "User not found" });
        let newMediaCount = user.mediaCount + 1;
        const videoId = user._id + newMediaCount;
        file.name = videoId;
        console.log(file.name);
        file.mv(`${path.join(__dirname, `..`, `..`, `database`, `${file.name}.mp4`)}`, async (err) => {
            if (err) {
                return res.status(500).json({ status: false, msg: "Something went wrong" });
            }
            const update = await Users.updateOne({ _id: new ObjectId(_id) }, { $set: { mediaCount: newMediaCount } });
            if (!update.acknowledged)
                return res.status(500).json({ status: false, msg: "Something went wrong" });
            const metaAdd = await Metadata.insertOne({ videoId: videoId, title: title, description: description, isPrivate: true, owner: _id, ownerName: user.username, processed: false });
            if (!metaAdd.acknowledged)
                return res.status(500).json({ status: false, msg: "Something went wrong" });
            console.log(`Video processing started - ${videoId}`);
            ffmpeg(`${path.join(__dirname, `..`, `..`, `database`, `${file.name}.mp4`)}`).addOptions([
                '-profile:v main',
                '-vf scale=w=1280:h=720:force_original_aspect_ratio=decrease',
                '-c:a aac',
                '-ar 48000',
                '-b:a 128k',
                '-c:v h264',
                '-crf 20',
                '-g 48',
                '-keyint_min 48',
                '-sc_threshold 0',
                '-b:v 2800k',
                '-maxrate 2996k',
                '-bufsize 4200k',
                '-hls_time 10',
                `-hls_segment_filename ${path.join(__dirname, `..`, `..`, `database`, `${videoId}_720p_%04d.ts`)}`,
                '-hls_playlist_type vod',
                '-f hls'
            ]).output(`${path.join(__dirname, `..`, `..`, `database`, `${file.name}.m3u8`)}`).on('end', processingDone).run()
            return res.status(200).json({ status: true, msg: "Upload successfull", videoId: videoId });
        });
    }
    catch (ex) {
        next(ex);
    }
};
//get a video details
module.exports.getDetails = async (req, res, next) => {
    try {
        const { _id, videoId, roomId } = req.body;
        const video = await Metadata.findOne({ videoId: videoId });
        if (roomId) {
            // roomID functionality shall be written here
        }

        else {
            if (!video)
                return res.status(500).json({ status: false, msg: "No video available" });
            if (_id === video.owner)
                res.status(200).json({ status: true, msg: "Video found", videoDetails: video });
            else
                return res.status(500).json({ status: false, msg: "Video is private" }); // to change
        }
    }
    catch (ex) {
        next(ex);
    }
};

//download request handler
module.exports.download = async (req, res, next) => {
    try {
        const { _id, videoId } = req.body;
        const videoDetails = await Metadata.findOne({ videoId: videoId });
        if (!(videoDetails.owner === _id))
            return res.status(400).json({ status: false, msg: "User not authorised" });
        const filePath = `${path.join(__dirname, `..`, `..`, `database`, `${videoId}.mp4`)}`;
        const fileName = `${videoDetails.title}.mp4`;
        res.header('Content-Disposition', `attachment; filename="${fileName}"`);
        res.status(200);
        fs.createReadStream(filePath).pipe(res);
    } catch (ex) {
        next(ex);
    }
};

// change video visibility
module.exports.changeVisibility = async (req, res, next) => {
    try {
        const { _id, videoId, isPrivate } = req.body;
        const video = await Metadata.findOne({ videoId: videoId });
        if (!(video.owner === _id))
            return res.status(500).json({ status: false, msg: "Video is private" });
        const update = await Metadata.updateOne({ videoId: videoId }, { $set: { isPrivate: isPrivate } });
        if (!update.acknowledged)
            return res.status(500).json({ status: false, msg: "Something went wrong" });
        const videoDetails = await Metadata.findOne({ videoId: videoId });
        if (!videoDetails)
            return res.status(500).json({ status: false, msg: "No video available" });
        else return res.status(200).json({ status: true, msg: "Visibility updated", videoDetails: videoDetails });
    }
    catch (ex) {
        next(ex);
    }
};

//get thumbnails
module.exports.getThumbs = async (req, res, next) => {
    try {
        const videoId = req.params.videoId;
        if (fs.existsSync(`${path.join(__dirname, `..`, `..`, `database`, `thumbnails`, `${videoId}.png`)}`))
            res.sendFile(`${path.join(__dirname, `..`, `..`, `database`, `thumbnails`, `${videoId}.png`)}`);
    } catch (ex) {
        next(ex);
    }
};