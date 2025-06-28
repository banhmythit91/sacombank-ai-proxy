// File: api/get-advice.js
// This code runs on a Vercel serverless function.
// It acts as a secure proxy to the Gemini API.

export default async function handler(request, response) {
  // Allow requests from any origin (for development)
  // For production, you should restrict this to your GitHub Pages URL
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests for CORS
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  // Get the user's data from the request body
  const { age, income, loanAmount, loanTerm } = request.body;

  if (!age || !income || !loanAmount || !loanTerm) {
    return response.status(400).json({ error: 'Missing required fields' });
  }
  
  // Securely get the API key from environment variables on the server
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
      return response.status(500).json({ error: 'API key not configured on the server.' });
  }

  // --- Construct the prompt on the server-side ---
  let personaPrompt;
  if (age < 35) {
      personaPrompt = `Bạn là Em Duy CVKH - một chuyên gia tư vấn tài chính từ Sacombank, với phong cách Gen Z, hài hước và vui tính. Hãy bắt đầu lời chào thật "cháy" và "keo lỳ", sau đó đi vào phân tích. Luôn gọi người dùng là "Anh/Chị".`;
  } else {
      personaPrompt = `Bạn là Em Duy - Chuyên gia tư vấn tài chính Sacombank. Hãy trả lời một cách chuyên nghiệp, nghiêm túc và rõ ràng. Bắt đầu bằng lời chào trang trọng và luôn gọi người dùng là "Anh/Chị".`;
  }

  const mainPrompt = `
Nhiệm vụ của bạn là phân tích thông tin khách hàng và hai gói vay dưới đây để đưa ra đề xuất phù hợp, kèm bảng tính tham khảo và phân tích khả năng trả nợ.

### Thông tin hai gói vay:
1.  **Z HOME (Nhà chất, trả chill):**
    * **Đối tượng:** 18-40 tuổi, mua nhà lần đầu.
    * **Mức vay tối đa:** 10 tỷ đồng.
    * **Lãi suất ưu đãi 12 tháng đầu:** 6.5%/năm.
2.  **PRIME HOME (An cư đẳng cấp):**
    * **Đối tượng:** Mua bất động sản thứ 2 trở lên.
    * **Mức vay:** Không giới hạn.
    * **Lãi suất ưu đãi 12 tháng đầu:** 8.0%/năm.

### Thông tin người dùng:
* **Tuổi:** ${age}
* **Thu nhập hàng tháng:** ${new Intl.NumberFormat('vi-VN').format(income)} VND
* **Số tiền muốn vay:** ${loanAmount} VND
* **Thời hạn vay:** ${loanTerm} năm

### Yêu cầu đầu ra:
1.  **Phân tích & Đề xuất:**
    * Dựa vào tuổi và nhu cầu vay, hãy xác định gói vay phù hợp.
    * Nếu tuổi từ 18-40 và số tiền vay <= 10000000000, hãy đề xuất gói **Z HOME**.
    * Nếu tuổi > 40 hoặc số tiền vay > 10000000000, hãy đề xuất gói **PRIME HOME**.
    * Giải thích ngắn gọn, súc tích lý do bạn đề xuất gói vay đó.

2.  **Phân tích khả năng trả nợ:**
    * Dựa trên gói vay được đề xuất, tính tổng số tiền trả tháng đầu tiên.
    * Tổng tiền trả tháng 1 = (Số tiền vay / (Thời hạn vay * 12)) + (Số tiền vay * (Lãi suất năm của gói vay / 12)).
    * So sánh \`Thu nhập hàng tháng\` (${income}) với \`Tổng tiền trả tháng 1\`.
    * Nếu thu nhập lớn hơn tổng tiền trả tháng 1, hãy nhận xét là "thu nhập của Anh/Chị về cơ bản đủ để chi trả khoản vay".
    * Nếu thu nhập nhỏ hơn, hãy nhận xét là "thu nhập hiện tại có thể chưa đủ, Anh/Chị nên cân nhắc giảm số tiền vay hoặc kéo dài thời hạn để giảm áp lực tài chính".

3.  **Ước tính trả nợ:**
    * Dựa vào gói vay đã đề xuất, hãy tính toán số tiền trả góp hàng tháng (gốc + lãi) và trình bày dưới dạng bảng cho 3 tháng đầu tiên.
    * Sử dụng công thức tính lãi suất theo dư nợ giảm dần.

4.  **Lưu ý quan trọng:**
    * Thêm một phần lưu ý rõ ràng rằng đây chỉ là ước tính sơ bộ và lãi suất có thể thay đổi.

5.  **Thông tin liên hệ (BẮT BUỘC):**
    * Luôn kết thúc bài tư vấn bằng phần thông tin liên hệ chính xác như sau, không được chỉnh sửa:
    > **Để được tư vấn chi tiết và chính xác nhất, Anh/Chị vui lòng liên hệ trực tiếp với Em Duy tại Sacombank Hà Thành - Số 25+27 Cửa Bắc, phường Trúc Bạch, quận Ba Đình, Hà Nội hoặc qua số điện thoại 0944 443 179.**
    > **Ngoài ra, Anh/Chị có thể điền thông tin vào Form đăng ký tư vấn bên dưới để được kết nối trực tiếp với Em Duy - Chuyên gia tư vấn tài chính Sacombank nhé!**

### Định dạng:
* Sử dụng tiếng Việt.
* Dùng Markdown để định dạng câu trả lời (tiêu đề, danh sách, in đậm) cho dễ đọc.
`;
            
  const finalPrompt = personaPrompt + mainPrompt;

  // --- Call the Gemini API ---
  const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ role: "user", parts: [{ text: finalPrompt }] }]
  };

  try {
    const geminiResponse = await fetch(geminiApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API call failed with status: ${geminiResponse.status}`);
    }

    const result = await geminiResponse.json();
    
    // Forward the Gemini response back to the client
    response.status(200).json(result);

  } catch (error) {
    console.error('Internal server error:', error);
    response.status(500).json({ error: error.message });
  }
}
