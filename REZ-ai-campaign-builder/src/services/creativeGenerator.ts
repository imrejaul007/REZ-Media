/**
 * Creative Generator Service
 * AI-generated ad copy
 */

export interface CreativeContent {
  headline: string;
  body: string;
  cta: string;
  imagePrompt?: string;
}

export class CreativeGenerator {

  /**
   * Generate creative for restaurant
   */
  generateRestaurantCreative(goal: string): CreativeContent {
    const templates = [
      {
        headline: 'Taste That Speaks!',
        body: 'Experience flavors that keep you coming back. Fresh ingredients, authentic recipes, unforgettable taste.',
        cta: 'Order Now',
      },
      {
        headline: 'Your Table Awaits',
        body: 'Join us for an unforgettable dining experience. Special dishes crafted daily.',
        cta: 'Book a Table',
      },
      {
        headline: 'Hungry? We Have Just What You Need',
        body: 'Delicious meals delivered to your door. Order now and get 15% off your first order!',
        cta: 'Order Online',
      },
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Generate creative for hotel
   */
  generateHotelCreative(goal: string): CreativeContent {
    const templates = [
      {
        headline: 'Your Perfect Stay Awaits',
        body: 'Book directly and save up to 20%. Early check-in available. Free cancellation. Experience luxury redefined.',
        cta: 'Book Now',
      },
      {
        headline: 'Stay Safe, Stay Comfy',
        body: 'Sanitized rooms, social distancing, contactless check-in. Your safety is our priority.',
        cta: 'View Rooms',
      },
      {
        headline: 'Weekend Getaway Deals',
        body: 'Special weekend rates starting ₹2,999. Includes breakfast and late checkout.',
        cta: 'Book Weekend',
      },
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Generate creative for retail
   */
  generateRetailCreative(goal: string): CreativeContent {
    const templates = [
      {
        headline: 'Discover Amazing Deals',
        body: 'New arrivals just dropped. Members get extra 10% off on everything. Shop the latest trends.',
        cta: 'Shop Now',
      },
      {
        headline: 'Sale Up to 50% Off',
        body: 'Limited time offer. Grab your favorites before they are gone. Free shipping on orders above ₹999.',
        cta: 'Shop Sale',
      },
      {
        headline: 'Your Style, Your Way',
        body: 'Curated collections for every occasion. Mix and match to create your perfect look.',
        cta: 'Explore',
      },
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Generate creative for fitness
   */
  generateFitnessCreative(goal: string): CreativeContent {
    const templates = [
      {
        headline: 'Transform Your Fitness Journey',
        body: 'Join today and get 1 month FREE. Expert trainers, modern equipment, 24/7 access.',
        cta: 'Start Free Trial',
      },
      {
        headline: 'New Year, New You',
        body: 'Fitness goals start here. Personal training, group classes, nutrition plans.',
        cta: 'Join Now',
      },
      {
        headline: 'Summer Shape-Up',
        body: 'Get beach-ready with our summer program. 20% off for limited time.',
        cta: 'Get Offer',
      },
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Generate creative by merchant type
   */
  generateCreative(goal: string, merchantType: string): CreativeContent {
    switch (merchantType) {
      case 'restaurant':
        return this.generateRestaurantCreative(goal);
      case 'hotel':
        return this.generateHotelCreative(goal);
      case 'retail':
        return this.generateRetailCreative(goal);
      case 'fitness':
        return this.generateFitnessCreative(goal);
      default:
        return this.generateGenericCreative(goal);
    }
  }

  /**
   * Generic creative
   */
  private generateGenericCreative(goal: string): CreativeContent {
    return {
      headline: 'Something Special Just for You',
      body: 'Check out our latest offerings. Quality you can trust, prices you will love.',
      cta: 'Learn More',
    };
  }
}

export const creativeGenerator = new CreativeGenerator();
