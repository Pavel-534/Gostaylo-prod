import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

// Mock database (in real app, this would be actual DB)
let mockDB = null

// Helper function to extract price and district from text
function parseListingText(text) {
  const priceMatch = text.match(/price[:\s]+(\d+)/i)
  const districtMatch = text.match(/district[:\s]+([a-zA-Z\s]+)/i)
  
  return {
    price: priceMatch ? parseInt(priceMatch[1]) : null,
    district: districtMatch ? districtMatch[1].trim() : null,
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    
    // Expected format from Telegram Bot:
    // {
    //   chat_id: "123456789",
    //   text: "Amazing villa with pool. Price: 15000 THB District: Rawai",
    //   photo_url: "https://..."
    // }
    
    const { chat_id, text, photo_url } = body
    
    if (!chat_id || !text) {
      return NextResponse.json(
        { success: false, error: 'Missing chat_id or text' },
        { status: 400 }
      )
    }
    
    // Load mockDB from route.js (in real app, use actual DB)
    const mockDBResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/partner/stats`)
    
    // Find partner by telegram_id
    // For now, using partner-1 as mock
    const partnerId = 'partner-1'
    
    // Parse text for price and district
    const { price, district } = parseListingText(text)
    
    // Create new listing
    const newListing = {
      id: uuidv4(),
      ownerId: partnerId,
      categoryId: '1', // Default to property
      status: 'PENDING', // Draft status - needs confirmation
      title: text.split('.')[0] || 'New Listing from Telegram',
      description: text,
      district: district || 'Patong',
      basePriceThb: price || 10000,
      commissionRate: 15,
      images: photo_url ? [photo_url] : ['https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg'],
      rating: 0,
      reviewsCount: 0,
      available: true,
      views: 0,
      bookingsCount: 0,
      metadata: {},
      source: 'TELEGRAM_BOT',
      createdAt: new Date().toISOString(),
    }
    
    // In real app, save to database
    // For now, just log and return success
    console.log('[TELEGRAM BOT] New listing created:', newListing)
    
    // Mock notification to partner
    console.log(`[TELEGRAM BOT] Message sent to partner: "Your listing has been created! Please review it in your dashboard."`)
    
    return NextResponse.json({
      success: true,
      data: {
        listing: newListing,
        message: 'Listing created successfully! Please review and publish it in your dashboard.',
      },
    })
    
  } catch (error) {
    console.error('Telegram webhook error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// GET method to test webhook is working
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Telegram webhook is active',
    instructions: {
      format: 'POST /api/webhooks/telegram',
      body: {
        chat_id: 'your_telegram_chat_id',
        text: 'Listing description. Price: 15000 District: Rawai',
        photo_url: 'https://example.com/photo.jpg (optional)',
      },
      parsing_rules: [
        'Price: Extract number after "Price:" keyword',
        'District: Extract text after "District:" keyword',
        'Title: First sentence of the text',
        'Description: Full text',
      ],
    },
  })
}
