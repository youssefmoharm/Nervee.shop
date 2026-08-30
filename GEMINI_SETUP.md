# 🔧 Google Gemini API Setup Guide

**Get your Google Gemini API key and integrate it with NERVE's AI chatbot.**

---

## 🎯 What You'll Get

With Gemini API:
- ✅ AI-powered chat support (free tier available)
- ✅ Order tracking with natural language
- ✅ Intelligent customer service
- ✅ Automatic escalation to human support
- ✅ 60 free requests/minute

---

## 📋 Step-by-Step Setup (5 minutes)

### Step 1: Get Your Gemini API Key

1. Go to: https://aistudio.google.com/apikey
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the key (starts with `AI...` or your key format)

**Your key format example:**
```
YOUR_GEMINI_API_KEY_HERE
```

---

### Step 2: Set the Key in Supabase

Run this command in your terminal:

```bash
supabase secrets set GOOGLE_GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
```

**Expected output:**
```
✅ Secret 'GOOGLE_GEMINI_API_KEY' created successfully
```

---

### Step 3: Verify the Key is Set

```bash
supabase secrets list
```

You should see `GOOGLE_GEMINI_API_KEY` in the list (value hidden for security).

---

### Step 4: Test the API Key

Run this command to test if your key works:

```bash
curl -X POST "https://aistudio.google.com/apikey" \
  -H "Authorization: Bearer YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"model": "models/gemini-pro", "contents": [{"parts": [{"text": "Hello"}]}]}'
```

**Expected response:**
```json
{
  "candidates": [{
    "content": {
      "parts": [{"text": "Hello! How can I help you today?"}]
    }
  }]
}
```

---

## 🧪 Testing Your Integration

### Option 1: Using Supabase Dashboard

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Go to **Edge Functions** → **logs**
4. Find `chat-ai` function
5. Click **Test** and enter:
```json
{
  "email": "test@example.com",
  "customerName": "Test User",
  "message": "Hello, I'm testing the chatbot"
}
```
6. Click **Run**

### Option 2: Using curl

```bash
curl -X POST "https://gfmxvvjqlhrnmidutjwx.supabase.co/functions/v1/chat-ai" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "customerName": "Test User",
    "message": "Can you help me track an order?"
  }'
```

---

## 📊 Monitoring Your Usage

### Check Gemini Usage

1. Go to: https://aistudio.google.com/usage
2. View your daily usage
3. See API calls breakdown

### Check Supabase Function Logs

1. Go to: Supabase Dashboard → Edge Functions
2. Click `chat-ai` function
3. Click **Logs** tab
4. View all function executions

---

## 💰 Cost Management

### Free Tier Limits
- **60 requests per minute**
- **15,000 requests per month**
- **Mostly free for small projects**

### Paid Tier
- **$0.00025 per 1K tokens** (very affordable)
- **1 million messages = ~$25**

### Set Up Budget Alerts

1. Go to: https://aistudio.google.com/app/billing
2. Set budget alert
3. Choose monthly limit
4. Get email when approaching limit

---

## 🆘 Troubleshooting

### Error: "Invalid API key"
**Solution:**
- Verify your key format
- Check for extra spaces
- Regenerate key if needed

### Error: "Quota exceeded"
**Solution:**
- Wait for quota reset (monthly)
- Or upgrade to paid tier
- Implement request throttling

### Error: "Function not responding"
**Solution:**
- Check Edge Function logs
- Verify API key is set correctly
- Check Supabase project status

### Error: "Rate limit exceeded"
**Solution:**
- Implement retry logic with exponential backoff
- Cache frequent responses
- Use queue system for high volume

---

## 🔄 Rotating Your API Key

If your key is compromised or you want to rotate it:

```bash
# 1. Create new key
# Go to: https://aistudio.google.com/apikey
# Click "Create API Key"

# 2. Update in Supabase
supabase secrets set GOOGLE_GEMINI_API_KEY=NEW_KEY_HERE

# 3. Verify
supabase secrets list

# 4. Test function
# Use test command above

# 5. (Optional) Delete old key
# Go to: https://aistudio.google.com/apikey
# Find old key and click "Delete"
```

---

## 📚 Additional Resources

- **Gemini API Docs:** https://ai.google.dev/docs
- **API Reference:** https://ai.google.dev/api
- **Pricing:** https://aistudio.google.com/app/pricing
- **Usage Limits:** https://aistudio.google.com/app/usage

---

## ✅ Setup Complete!

After completing these steps:

1. ✅ Your API key is securely stored
2. ✅ Edge functions can access it
3. ✅ AI chatbot will use Gemini
4. ✅ You can monitor usage
5. ✅ You can troubleshoot issues

**Next Steps:**
- Test the chatbot with real messages
- Monitor usage in Dashboard
- Set up budget alerts
- Customize system prompt if needed

---

## 🆘 Need Help?

### Quick Debug Commands

```bash
# Check secret is set
supabase secrets list | grep GEMINI

# Check function logs
supabase functions logs chat-ai

# Test function locally
supabase functions invoke chat-ai --data '{"email":"test@example.com","message":"test"}'
```

### Check API Key Validity

```bash
curl -H "Content-Type: application/json" \
  -d '{"model":"models/gemini-pro","contents":[{"parts":[{"text":"test"}]}]}' \
  https://aistudio.google.com/apikey
```

---

**Good luck! Your AI chatbot is ready to help customers! 🚀**

---

**Date:** August 19, 2026  
**Project:** Nerve E-Commerce  
**Status:** Setup Complete ✅