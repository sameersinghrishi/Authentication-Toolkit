import { Router } from "express";
import { registerUser ,loginUser, logout, refreshAccessToken, changecurrentPassword, getCurrentUser, updateAccountDetails, updateAvatar, updatecoverImage, getChannelProfile, getWatchHistory} from "../controllers/user.controllers.js";
import {upload} from "../middlewares/multer.middleware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";
const router =Router()

router.route("/register").post(
   upload.fields([
       {
           name: "avatar",
           maxCount: 1
       }, 
       {
           name: "coverImage",
           maxCount: 1
       }
   ]),
   registerUser
   )


   router.route("/login").post(loginUser)

   router.route("/logout").post(verifyJWT,logout)

   router.route("/refresh-token").post(refreshAccessToken)

   router.route("/changePassword").post(verifyJWT,changecurrentPassword)

   router.route("/getCurrentUser").post(verifyJWT,getCurrentUser)

   router.route("/updateAccountDetails").post(verifyJWT,updateAccountDetails)

   router.route("/updateAvatar").post(
    verifyJWT, upload.single("avatar"),updateAvatar)

    router.route("/updatecoverImage").post(
        verifyJWT, upload.single("coverImage"),updatecoverImage)


    router.route("/c/:username").get(verifyJWT, getChannelProfile)
    router.route("/history").get(verifyJWT, getWatchHistory)

export default router;