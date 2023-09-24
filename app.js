import express from 'express'
const app = express()
import http from 'http'
const server = http.createServer(app);
import { Server } from "socket.io";
import session from "express-session";
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === "production" ? 'https://goossipclientstg-30cd4ca2f0fc.herokuapp.com/' : 'https://goossipclientstg-30cd4ca2f0fc.herokuapp.com/',
        methods: ["GET", "POST"],
        allowedHeaders: ["https://goossipclientstg-30cd4ca2f0fc.herokuapp.com/"],
        credentials: true

    }
});
import bodyParser from "body-parser";

import user_router from './/routers/user-router.js'
import postRouter    from "./routers/post-router.js";
import chat_router   from "./routers/chat-router.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import {getUserFromSocketCookie} from "./middleware/auth.js";
import {
    createPrivateConversation, getConversation, getConversationMembers, getConversationMessages, GetConversationWithMembers,
    getUserConversations,
    storeMessage
} from "./db/conversation-db.js";
import {getFriendRequests, getMutuals, getUserByUsername, getUserStats} from "./db/user-db.js";
import {getUserById} from "./db/user-db.js";
import {getUserLikedPosts, getUserPosts, getUserPostsPhotos, getUserRetweets} from "./db/post-db.js";


let corsOptions = {
    origin: process.env.NODE_ENV === "production" ? 'https://goossipclientstg-30cd4ca2f0fc.herokuapp.com/' : 'https://goossipclientstg-30cd4ca2f0fc.herokuapp.com/',
    allowedHeaders: ["https://goossipclientstg-30cd4ca2f0fc.herokuapp.com/"],
    credentials: true
}
app.use(cors(corsOptions))
app.use(express.json())
app.use(postRouter)
app.use(user_router)
app.use(chat_router)
app.use(cookieParser())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended:true }));

let authedSockets= []



//add to authedSockets array
function addAuthedSocket(socket, user){
    
    if(!isSocketConnected(socket.id)){
        authedSockets.push({socket: socket, user: user})
    }

    
    for (let i = 0; i < authedSockets.length; i++) {
        

    }
}
//remove from authedSockets array
function isSocketConnected(socketId){
    return authedSockets.some(authedSocket=> authedSocket.socket.id === socketId)
}
function removeAuthedSocket(socketId)
{
    
    authedSockets = authedSockets.filter((authedSocket)=> {
        return authedSocket.socket.id !== socketId
    })
    
    
}

//get user from authedSockets array
function getUserFromAuthedSockets(socketId){
    return authedSockets.find((authedSocket)=> {
        return authedSocket.socket.id === socketId
    })?.user
}
//get socket from authedSockets array
function getSocketFromAuthedSockets(id){
    return authedSockets.filter((authedSocket)=> {
        
        
        
        
        return authedSocket.user.id == id
    })[0].socket
}


io.use(async (socket, next) => {
    
    const user = await getUserFromSocketCookie(socket.handshake.headers.cookie)
    if (!user) {
        return next(new Error("invalid token"))
    }
    socket.user = user
    addAuthedSocket(socket, user)
    next()
})
io.on('connection', async (socket) => {
    

    //every conversations room
    await getUserConversations(socket.user.id).then(conversations => {
        conversations.forEach(conversation => {
            if(conversation.isGroupChat){
                socket.join(conversation.id)
            }

        })
    })
    socket.on('private chat message', async (receiverID, body, media,conversationID) => {
        try{
            
            let conversation_id = conversationID
            
            
            let user = getUserFromAuthedSockets(socket.id)
            

            if(body.length !== 0){
                await sendMessageToUser(user.id, receiverID, body, false,conversation_id)
            }

            media.map(async media => {
                //NOTE: send media
                await sendMessageToUser(user.id, receiverID, media, true,conversation_id)
            })
        }catch (e) {
            
        }

    })
    socket.on('group chat message', async (conversationID, body,media )=> {
        try{
            
            //NOTE: send text
            await sendMessageToConversation(socket.id, conversationID, body, false)
            media.map(async media => {
                //NOTE: send media
                await sendMessageToConversation(socket.id, conversationID, media, true)
            })
        }catch (e) {
            
        }


    })
    socket.on('disconnect', () => {
        
        removeAuthedSocket(socket.id)
    });
});



//send message to conversation
async function sendMessageToConversation(socketID, conversationID, body, isFile) {
    //do some validation,

    //store message in server
    let user = getUserFromAuthedSockets(socketID)
    await storeMessage(conversationID, user.id, body, isFile)

    //emmit msg
    io.to(conversationID).emit('chat message', body, isFile)
//send message to all users in conversation
}

//send message to user
async function sendMessageToUser(senderID, receiverID, body, isFile,conversationID) {
    //do some validation,
    try{
        //get user from reciever username
        let receiver = await getUserById(receiverID)
        //store message in server
        let user = await getUserById(senderID)

        //if user is not in conversation, create conversation, check first
        let conversation = await getConversation(conversationID)

        
        
        await storeMessage(conversation.conversation_id, senderID, body, isFile)

        //NOTE: emit message to user
        //NOTE: get socket from authedSockets array
        
        let socket = getSocketFromAuthedSockets(receiverID)
        
        if(!socket){
            
            return
        }

        
        io.to(getSocketFromAuthedSockets(receiverID).emit('chat message', {value:body, isFile,sender_id:senderID}))
    }catch (e){
        
        return e
    }

}


// 
// 
// 
// 
// 
//


server.listen(8080, () => console.log('listening on *:8080'));