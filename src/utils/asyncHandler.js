const asyncHandler = (request) => {
   return (req,res,next)=>{
      Promise.resolve(request(req,res,next)).catch((err)=> next(err))
   }
}
export {asyncHandler}

// const asyncHandler=(request)=>async (req,res,next)=>{
//    try {
//       await request(req,res,next)
//    } catch (error) {
//       res.status(error.code || 500).json({
//          success: false,
//          message: error.message
//      });
//    }
// }