import React, { useEffect, useState, useRef } from "react";
import { getDetailsRoute, roomDetailsRoute, exitRoomRoute, roomMediaClearRoute, host } from "../utils/APIRoutes";
import { useNavigate, useParams } from "react-router-dom";
import { Slide, ToastContainer, toast } from "react-toastify";
import { io } from "socket.io-client";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";
import Player from "../components/Player";
import "react-toastify/dist/ReactToastify.css";
import "../css/InRoom.css";

export default function InRoom() {
    const socket = useRef();
    const navigate = useNavigate();
    const [videoId, setVideoId] = useState("");
    const [presenter, setPresenter] = useState(false);
    const [values, setValues] = useState({ videoId: "" });
    const [roomDetails, setRoomDetails] = useState({ membersNames: [] });
    const [selectVideo, setSelectVideo] = useState(false);
    const [key, setKey] = useState("");
    const toastId = React.useRef(null);
    const toastClipboardId = React.useRef(null);
    const user = JSON.parse(localStorage.getItem(process.env.MOTION_APP_LOCALHOST_KEY));
    const toastOptions = {
        position: "bottom-right",
        autoClose: 5000,
        transition: Slide,
        hideProgressBar: true,
        pauseOnHover: false,
        pauseOnFocusLoss: false,
        draggable: false,
        closeButton: false,
    };
    const { roomId } = useParams();
    window.onbeforeunload = (event) => {
        exit();
    }
    useEffect(() => {
        const setVideoSocket = async (videoId) => {
            const user = await JSON.parse(localStorage.getItem(process.env.MOTION_APP_LOCALHOST_KEY));
            const payload = { owner: roomDetails.owner, _id: user._id, roomId: roomDetails.roomId, videoId: videoId };
            await socket.current.emit("set-video", payload);
        }
        const removeVideoSocket = async () => {
            const user = await JSON.parse(localStorage.getItem(process.env.MOTION_APP_LOCALHOST_KEY));
            const payload = { owner: roomDetails.owner, _id: user._id, roomId: roomDetails.roomId };
            await socket.current.emit("remove-video", payload);
        }
        async function fetchData() {
            const video = document.getElementById("videoPlayer");
            if (videoId && presenter) {
                const VideoId = videoId;
                const state = video.paused;
                const position = video.currentTime;
                setVideoId("");
                setKey(uuidv4());
                removeVideoSocket();
                await new Promise(res => setTimeout(res, 50));
                setVideoId(VideoId);
                setVideoSocket(VideoId);
                await new Promise(res => setTimeout(res, 50));
                const videoUpdated = document.getElementById("videoPlayer");
                if (state)
                    videoUpdated.pause();
                else
                    videoUpdated.play();
                videoUpdated.currentTime = position;
            }
        }
        fetchData();
    }, [roomDetails]); // eslint-disable-line
    useEffect(() => {
        const removeVideoSocket = async () => {
            const user = await JSON.parse(localStorage.getItem(process.env.MOTION_APP_LOCALHOST_KEY));
            const payload = { owner: roomDetails.owner, _id: user._id, roomId: roomDetails.roomId };
            await socket.current.emit("remove-video", payload);
        }
        const exit = async () => {
            const user = await JSON.parse(localStorage.getItem(process.env.MOTION_APP_LOCALHOST_KEY));
            try {
                const { data } = await axios.post(`${exitRoomRoute}`, { roomId: roomId, _id: user._id });
                if (data.status === true) {
                    if (videoId && presenter) {
                        setVideoId("");
                        setKey(uuidv4());
                        await removeVideoSocket();
                    }
                    navigate('/');
                    window.location.reload(false);
                }
            } catch (err) {
                if (err.response && err.response.status && err.response.status === 400)
                    toast.error(err.response.data.msg, toastOptions);
                else
                    navigate("/error");
            }
        }
        async function fetchData() {
            const user = await JSON.parse(localStorage.getItem(process.env.MOTION_APP_LOCALHOST_KEY));
            try {
                const { data } = await axios.post(`${roomDetailsRoute}`, { roomId: roomId, _id: user._id });
                if (data.status === true) {
                    setRoomDetails(data.roomDetails);
                    socket.current = io(host);
                    socket.current.emit("in-room", { roomDetails: data.roomDetails, _id: user._id });
                    socket.current.on("room-update", async () => {
                        try {
                            const { data } = await axios.post(`${roomDetailsRoute}`, { roomId: roomId, _id: user._id });
                            if (data.status === true)
                                setRoomDetails(data.roomDetails);
                        } catch (err) {
                            if (err.response && err.response.status && err.response.status === 400)
                                toast.error(err.response.data.msg, toastOptions);
                            else
                                navigate("/error");
                        }
                    });
                    socket.current.on("get-video", async (payload) => {
                        if (!(user._id === payload.presenter)) {
                            setPresenter(false);
                            setVideoId(payload.videoId);
                            setKey(uuidv4());
                        }
                    });
                    socket.current.on("leave-room", async () => {
                        exit();
                    });
                    socket.current.on("recieve-room-request", async (payload) => {
                        toast(
                            <div className="accept-reject-options">
                                <div className="accept-reject-options-title">
                                    Incoming Request: {payload.username.charAt(0).toUpperCase() + payload.username.slice(1)} !
                                </div>
                                <div>
                                    <button className="accept" onClick={async () => {
                                        socket.current.emit("approve-room-request", payload);
                                    }
                                    }>Accept</button>
                                    <button className="reject">Reject</button>
                                </div>
                            </div>
                            ,
                            toastOptions);
                    });
                }
                else
                    navigate("/error");
            } catch (err) {
                if (err.response && err.response.status && err.response.status === 400)
                    toast.error(err.response.data.msg, toastOptions);
                else
                    navigate("/error");
            }
        }
        fetchData();
    }, [navigate, roomId]); // eslint-disable-line
    const copyId = () => {
        navigator.clipboard.writeText(roomDetails.roomId);
        if (!toast.isActive(toastClipboardId.current)) {
            toastClipboardId.current = toast.info("Room Id copied", toastOptions);
        }
    }
    const kick = async (memberName) => {
        const user = await JSON.parse(localStorage.getItem(process.env.MOTION_APP_LOCALHOST_KEY));
        const payload = { owner: user._id, roomId: roomDetails.roomId, memberName: memberName }
        socket.current.emit("kicked", payload);
    }
    const ban = async (memberName) => {
        const user = await JSON.parse(localStorage.getItem(process.env.MOTION_APP_LOCALHOST_KEY));
        const payload = { owner: user._id, roomId: roomDetails.roomId, memberName: memberName }
        socket.current.emit("banned", payload);
    }
    const showOptions = async (memberName) => {
        const user = await JSON.parse(localStorage.getItem(process.env.MOTION_APP_LOCALHOST_KEY));
        if (!toast.isActive(toastId.current) && (roomDetails.owner === user._id) && !(user.username === memberName)) {
            toastId.current = toast.warning(
                <div className="kick-ban-options">
                    <div className="kick-ban-options-title">
                        Kick or Ban {memberName.charAt(0).toUpperCase() + memberName.slice(1)}?
                    </div>
                    <div>
                        <button className="kick" onClick={() => kick(memberName)}>Kick</button>
                        <button className="ban" onClick={() => ban(memberName)}>Ban</button>
                    </div>
                </div>
                ,
                toastOptions);
        }
    }
    const exit = async () => {
        const user = await JSON.parse(localStorage.getItem(process.env.MOTION_APP_LOCALHOST_KEY));
        try {
            const { data } = await axios.post(`${exitRoomRoute}`, { roomId: roomId, _id: user._id });
            if (data.status === true) {
                if (videoId && presenter) {
                    setVideoId("");
                    setKey(uuidv4());
                    await removeVideoSocket();
                }
                navigate('/');
                window.location.reload(false);
            }
        } catch (err) {
            if (err.response && err.response.status && err.response.status === 400)
                toast.error(err.response.data.msg, toastOptions);
            else
                navigate("/error");
        }
    }
    const setVideoSocket = async (videoId) => {
        const user = await JSON.parse(localStorage.getItem(process.env.MOTION_APP_LOCALHOST_KEY));
        const payload = { owner: roomDetails.owner, _id: user._id, roomId: roomDetails.roomId, videoId: videoId };
        await socket.current.emit("set-video", payload);
    }
    const removeVideoSocket = async () => {
        const user = await JSON.parse(localStorage.getItem(process.env.MOTION_APP_LOCALHOST_KEY));
        const payload = { owner: roomDetails.owner, _id: user._id, roomId: roomDetails.roomId };
        await socket.current.emit("remove-video", payload);
    }
    const stopSharing = async () => {
        if (presenter) {
            const user = await JSON.parse(localStorage.getItem(process.env.MOTION_APP_LOCALHOST_KEY));
            try {
                const { data } = await axios.post(`${roomMediaClearRoute}`, { _id: user._id, roomId: roomDetails.roomId });
                if (data.status === true) {
                    setVideoId("");
                    setPresenter(false);
                    setKey(uuidv4());
                    removeVideoSocket();
                }
            } catch (err) {
                if (err.response && err.response.status && err.response.status === 400)
                    toast.error(err.response.data.msg, toastOptions);
                else
                    navigate("/error");
            }
        }
    }
    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!videoId) {
            if (values.videoId === "")
                toast.error("videoId Required", toastOptions);
            else {
                try {
                    const user = await JSON.parse(localStorage.getItem(process.env.MOTION_APP_LOCALHOST_KEY));
                    const { data } = await axios.post(`${getDetailsRoute}`, { _id: user._id, roomId: roomDetails.roomId, videoId: values.videoId }, { withCredentials: true });
                    if (data.status === true) {
                        setVideoSocket(values.videoId);
                        setPresenter(true);
                        setVideoId(values.videoId);
                        setKey(uuidv4());
                    }
                } catch (err) {
                    if (err.response && err.response.status && err.response.status === 400)
                        toast.error(err.response.data.msg, toastOptions);
                    else
                        navigate("/error");
                }
            }
        }
    };
    const handleChange = (event) => { setValues({ ...values, [event.target.name]: event.target.value }) };
    return (
        <>
            <div className="body">
                <div className="inRoomTitleContainer">
                    <p className="inRoomTitle">Room</p>
                </div>
                <div className="inRoomParentBox">
                    <div className="content">
                        {
                            !(videoId) ?
                                <>
                                    {
                                        !(selectVideo) ?
                                            <>
                                                <button className="playContent" onClick={() => setSelectVideo(true)}>Play Some Video</button>
                                            </>
                                            :
                                            <>
                                                <form className="formMain" onSubmit={(event) => handleSubmit(event)}>
                                                    <input type="text" className="videoIdForm" placeholder="Enter some Id" name="videoId" onChange={(e) => handleChange(e)} min="3" autoComplete="off" />
                                                    {
                                                        (values.videoId) ?
                                                            <>
                                                                <button className="playContent" type="submit">Play</button>
                                                            </>
                                                            :
                                                            <>
                                                                <button className="playContentDisabled" type="submit" disabled={true}><span title="Enter Video Id to Play">Play</span></button>
                                                            </>
                                                    }
                                                    <button className="back" onClick={() => setSelectVideo(false)}>Back</button>
                                                </form>
                                            </>
                                    }
                                </>
                                :
                                <>
                                    <Player key={key} videoId={videoId} presenter={presenter} roomDetails={roomDetails} socket={socket} />
                                </>
                        }
                    </div>
                    <div className="members">
                        <button className="copyId" onClick={() => copyId()}>Copy Room Id</button>
                        {
                            (presenter) ?
                                <button className="stopSharing" onClick={() => {
                                    stopSharing();
                                    setValues({ videoId: "" });
                                }}>Stop Sharing</button>
                                :
                                <>
                                </>
                        }
                        <button className="exitRoom" onClick={() => exit()}>Exit Room</button>
                        {roomDetails.membersNames.map((memberName) => {
                            return (
                                <div onClick={async () => {
                                    const user = await JSON.parse(localStorage.getItem(process.env.MOTION_APP_LOCALHOST_KEY));
                                    if ((roomDetails.owner === user._id) && !(user.username === memberName))
                                        showOptions(memberName);
                                }} className={(roomDetails.owner === user._id) && !(user.username === memberName) ? "optionsMemberBox" : "non-OptionsMemberBox"} key={uuidv4()}>{memberName.charAt(0).toUpperCase() + memberName.slice(1)}</div>
                            );
                        })}
                    </div>
                </div>
            </div>
            <ToastContainer style={{ backgroundColor: "rgba(0, 0, 0, 0)", overflow: "hidden" }} toastStyle={{ backgroundColor: "#1b1b1b" }} newestOnTop />
        </>
    )
}
