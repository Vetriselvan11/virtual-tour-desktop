/**
 * Formats a successful response. 
 * If the current application expects plain JSON without a wrapper, 
 * this helper adapts to preserve API contracts.
 */
function sendSuccess(res, statusCode, data) {
  // Existing API contract just sends the data directly for GET/POST, 
  // not wrapped in { success: true, data: ... }. We MUST preserve this.
  // Exception: if data is a message object like { message: "..." }, it sends that.
  return res.status(statusCode).json(data);
}

module.exports = {
  sendSuccess
};
