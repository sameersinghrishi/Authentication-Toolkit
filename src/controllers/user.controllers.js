import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User} from "../models/users.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";
import bcrypt from "bcrypt"
const registerUser = asyncHandler( async (req, res) => {
   // get user details from frontend
   // validation - not empty
   // check if user already exists: username, email
   // check for images, check for avatar
   // upload them to cloudinary, avatar
   // create user object - create entry in db
   // remove password and refresh token field from response
   // check for user creation
   // return res


   let {fullName, email, username, password } = req.body
   //console.log("email: ", email);

   if (
       [fullName, email, username, password].some((field) => field?.trim() === "")
   ) {
       throw new ApiError(400, "All fields are required")
   }

   const existedUser = await User.findOne({
       $or: [{ username }, { email }]
   })

   if (existedUser) {
       throw new ApiError(409, "User with email or username already exists")
   }
   console.log(req.files);

   const avatarLocalPath = req.files?.avatar[0]?.path;
   
   let coverImageLocalPath ;
   if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length >0){
    coverImageLocalPath = req.files?.coverImage[0]?.path;
   }
   console.log(avatarLocalPath);
   if (!avatarLocalPath) {
       throw new ApiError(400, "Avatar file is required")
   }

   const avatar = await uploadOnCloudinary(avatarLocalPath)
   const coverImage = await uploadOnCloudinary(coverImageLocalPath)
   console.log(avatar)
   if (!avatar) {
       throw new ApiError(400, "Avatar file is required")
   }
  
   
   const user = await User.create({
       fullName,
       avatar: avatar.url,
       coverImage: coverImage?.url || "",
       email, 
       password,
       username: username.toLowerCase()
   })
   const createdUser = await User.findById(user._id).select(
       "-password -refreshToken" //writing this not req initially
   )

   if (!createdUser) {
       throw new ApiError(500, "Something went wrong while registering the user")
   }

   return res.status(201).json(
       new ApiResponse(200, createdUser, "User registered Successfully")
   )

} )




const generateAccessAndRefreshTokens=async(userId)=>{
    try {
        const user=await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken=refreshToken
        await user.save({ validateBeforeSave: false })
        console.log(refreshToken)
        return {accessToken,refreshToken}
    } catch (error) {
        throw new ApiError("500","Error in generating acess and refresh tokens ")
    }
}

const loginUser =asyncHandler(async (req,res)=>{
    const {email, username, password} = req.body
    console.log(password);
    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }

    const user=await User.findOne({
        $or:[{username},{email}]
    }) 

    if(!user ){
        throw new ApiError(404,"User does not exsist")
    }

    const isPasswordValid=await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credentials " )
    }

    const {accessToken,refreshToken}=await generateAccessAndRefreshTokens(user._id)
    const options = {
        httpOnly: true,
        secure: true
    }
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(200,
            {
                user :loggedInUser,accessToken,refreshToken
            },
            "User created successfully"
        )
    )
})

const logout=asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new:true
        }
    )
    const options={
        httpOnly:true,
        secure:true
    }
    return res.status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logged out"))    
})

const refreshAccessToken=asyncHandler(async(req,res)=>{
    const incomingToken=await req.cookies.refreshToken || req.body.refreshToken 

    if(!incomingToken){
        throw new ApiError(401,"Unauthorized access")
    }
    const decodedToken = jwt.verify(incomingToken, process.env.REFRESH_TOKEN_SECRET)

    console.log(decodedToken)

    const user=await User.findById(decodedToken?._id)

    if(!user){
        throw new ApiError(401, "Invalid refresh token")
    }

    if(incomingToken!=user?.refreshToken){
        throw new ApiError(400, "Incorrect refresh token")
    }
    const {accessToken,refreshToken}=await generateAccessAndRefreshTokens(user._id)
    const options={
        httpOnly:true,
        secure:true
    }
    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(new ApiResponse(
        200,
        {accessToken,refreshToken:refreshToken},
        "Token refreshed successfully"
    ))

})

const changecurrentPassword=asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword}=req.body

    if(!newPassword || !oldPassword){
        throw new ApiError(400,"Every field is required")
    }

    const user=await User.findById(req?.user._id)
    if(!user){
        throw new ApiError(400,"User id not found")
    }

    const isPasswordValid=await user.isPasswordCorrect(oldPassword)

    if(!isPasswordValid){
        throw new ApiError(402,"Wrong Old Password")
    }

    user.password=newPassword
    user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(
        new ApiResponse(
            201,
            {newPassword},
            "Password Changed Successfully"
        )
    )

})

const getCurrentUser=asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(new ApiResponse(200,req.user,"Feteched current user details successfully"))
})


const updateAccountDetails=asyncHandler(async(req,res)=>{

    const {fullName ,email}=req.body
    if(!fullName || !email){
        throw new ApiError(400,"Every Field is Required")
    }
    const user=await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName:fullName,
                email
            }
        },
        {
            new:true
        }
    )

    if(!user){
        throw new ApiError(402,"Incorrect user id")
    }
    return res
    .status(200)
    .json(new ApiResponse(200,user,"Updated credentials successfully"))
})


const updateAvatar=asyncHandler(async(req,res)=>{
    const avatarLocalPath=req?.file?.path;
    // console.log(req.file)
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar Local Path Not Found")
    }

    const avatar=await uploadOnCloudinary(avatarLocalPath)
    if(!avatar.url){
        throw new ApiError(400,"Avatar uploading on Cloudinary Failed")
    }
    if(!req.user._id){
        throw new ApiError(403,"No user logged in")
    }
    const user=await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {
            new :true
        }
    )
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "Avatar updated successfully"
        )
    )
})

const updatecoverImage=asyncHandler(async(req,res)=>{
    const coverImageLocalPath=req?.file?.path;
    // console.log(req.file)
    if(!coverImageLocalPath){
        throw new ApiError(400,"coverImage Local Path Not Found")
    }

    const coverImage=await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url){
        throw new ApiError(400,"coverImage uploading on Cloudinary Failed")
    }
    if(!req.user._id){
        throw new ApiError(403,"No user logged in")
    }
    const user=await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {
            new :true
        }
    )
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "coverImage updated successfully"
        )
    )
})


const getChannelProfile=asyncHandler(async(req,res)=>{
    const {username} = req.params

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing")
    }
    
    const channel=await User.aggregate([
        {
            $match:{
                username:username.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields:{
                subscriberCount:{
                    $size:"$subscribers"
                },
                subscribedToCount:{
                    $size:"$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        }
        ,
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1

            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})




export {
    registerUser,
    loginUser,
    logout,
    refreshAccessToken,
    changecurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateAvatar,
    updatecoverImage,
    getChannelProfile,
    getWatchHistory
}