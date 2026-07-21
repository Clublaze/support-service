// Adds res.success() and res.error() helpers to every response object.
// Same pattern as your other services so controllers look identical.
const responseUtil = (req, res, next) => {
  res.success = (data = null, message = 'Success', statusCode = 200) => {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  };

  res.error = (message = 'Something went wrong', statusCode = 500) => {
    return res.status(statusCode).json({
      success: false,
      message,
      data: null,
    });
  };

  next();
};

export default responseUtil;
