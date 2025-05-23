import request from 'supertest';
import mongoose from 'mongoose';
import initApp from '../server';
import { Express } from 'express';
import { IItem } from '../models/item_model';
import visionService from '../services/vision-service';

let app: Express;
let accessToken: string;

beforeAll(async () => {
  app = await initApp();
  // Register and login to get a token
  await request(app)
    .post('/auth/register')
    .send({
      email: 'test.image.comparison@example.com',
      password: 'password123',
      userName: 'test_image_comparison'
    });
  
  const loginResponse = await request(app)
    .post('/auth/login')
    .send({
      email: 'test.image.comparison@example.com',
      password: 'password123'
    });
  
  accessToken = loginResponse.body.accessToken;
}, 30000);

afterAll(async () => {
  await mongoose.connection.close();
});

describe('Image Comparison API', () => {
  describe('Image Analysis', () => {
    it('should analyze an image URL', async () => {
      const imageUrl = 'https://storage.googleapis.com/gweb-uniblog-publish-prod/images/googles_approach_to_ai_2x.max-1000x1000.png';
      
      const res = await request(app)
        .post('/api/image-comparison/analyze')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ imageUrl });
      
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('labels');
      expect(res.body.data).toHaveProperty('objects');
      expect(res.body.data).toHaveProperty('webEntities');
    });

    it('should return 400 if no image URL is provided', async () => {
      const res = await request(app)
        .post('/api/image-comparison/analyze')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});
      
      expect(res.status).toBe(400);
    });
  });

  describe('Image Comparison', () => {
    it('should compare two images', async () => {
      const image1Url = 'https://storage.googleapis.com/gweb-uniblog-publish-prod/images/googles_approach_to_ai_2x.max-1000x1000.png';
      const image2Url = 'https://storage.googleapis.com/gweb-uniblog-publish-prod/images/googles_approach_to_ai_2x.max-1000x1000.png';
      
      const res = await request(app)
        .post('/api/image-comparison/compare')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ image1Url, image2Url });
      
      expect(res.status).toBe(200);
      expect(res.body.data.matches[0]).toHaveProperty('score');
      expect(res.body.data.matches[0]).toHaveProperty('details');
      
      // Same image should have a high score
      expect(res.body.data.matches[0].score).toBeGreaterThan(80);
    });

    it('should return 400 if image URLs are missing', async () => {
      const res = await request(app)
        .post('/api/image-comparison/compare')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ image1Url: 'https://example.com/image.jpg' });
      
      expect(res.status).toBe(400);
    });
  });

  describe('Service Methods', () => {
    it('should correctly find matches for an item', async () => {
      // Mock items for testing
      const lostItem: IItem = {
        _id: new mongoose.Types.ObjectId().toString(),
        userId: 'user123',
        imageUrl: 'https://storage.googleapis.com/gweb-uniblog-publish-prod/images/googles_approach_to_ai_2x.max-1000x1000.png',
        itemType: 'lost',
        description: 'Test item',
        visionApiData: {
          labels: ['Test', 'Item', 'Logo'],
          objects: [{ name: 'Logo', score: 0.9 }]
        },
        isResolved: false
      };
      
      const foundItem: IItem = {
        _id: new mongoose.Types.ObjectId().toString(),
        userId: 'user456',
        imageUrl: 'https://storage.googleapis.com/gweb-uniblog-publish-prod/images/googles_approach_to_ai_2x.max-1000x1000.png',
        itemType: 'found',
        description: 'Found test item',
        visionApiData: {
          labels: ['Test', 'Item', 'Logo'],
          objects: [{ name: 'Logo', score: 0.85 }]
        },
        isResolved: false
      };
      
      const result = await visionService.compareImages(lostItem.imageUrl, foundItem.imageUrl);
      
      expect(result).toHaveProperty('similarityScore');
      expect(result.similarityScore).toBeGreaterThan(50);
      expect(result).toHaveProperty('details');
      expect(result.details).toHaveProperty('labelSimilarity');
      expect(result.details).toHaveProperty('objectSimilarity');
      expect(result.details).toHaveProperty('webEntitySimilarity');
    });
  });
}); 