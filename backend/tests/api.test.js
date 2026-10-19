const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { randomBytes } = require('node:crypto');
const { createApp } = require('../src/app');
const User = require('../src/models/User');
const Track = require('../src/models/Track');
const Playlist = require('../src/models/Playlist');

const config = {
  nodeEnv: 'test',
  clientOrigin: 'http://localhost:5173',
  jwtSecret: randomBytes(32).toString('hex'),
  jwtExpiresIn: '1h',
  uploadDir: '/tmp/music-manager-test-uploads',
  maxUploadSizeMb: 1
};
const app = createApp(config);
const tokenFor = (id) => jwt.sign({ sub: id }, config.jwtSecret);

beforeEach(() => { mongoose.connection.readyState = 1; });
afterEach(() => jest.restoreAllMocks());
afterAll(() => { mongoose.connection.readyState = 0; });

describe('Music Manager API', () => {
  test('reports service health', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'connected', service: 'music-manager-api' });
  });

  test('exposes Prometheus request metrics', async () => {
    const response = await request(app).get('/metrics');
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/plain/);
    expect(response.text).toContain('music_manager_http_requests_total');
    expect(response.text).toContain('music_manager_http_request_duration_seconds');
  });

  test('registers an account with a bcrypt hash and returns a JWT', async () => {
    jest.spyOn(User, 'exists').mockResolvedValue(null);
    jest.spyOn(User, 'create').mockImplementation(async (values) => ({
      id: 'user-123', displayName: values.displayName, email: values.email
    }));

    const response = await request(app).post('/api/auth/register').send({
      displayName: 'Mira', email: 'MIRA@example.test', password: 'correct-horse-7'
    });

    expect(response.status).toBe(201);
    expect(response.body.user).toEqual({ id: 'user-123', displayName: 'Mira', email: 'mira@example.test' });
    expect(response.body.token).toBeTruthy();
    const hash = User.create.mock.calls[0][0].passwordHash;
    expect(hash).not.toBe('correct-horse-7');
    expect(await bcrypt.compare('correct-horse-7', hash)).toBe(true);
    expect(jwt.verify(response.body.token, config.jwtSecret).sub).toBe('user-123');
  });

  test('rejects a weak password before touching the database', async () => {
    const exists = jest.spyOn(User, 'exists');
    const response = await request(app).post('/api/auth/register').send({
      displayName: 'Mira', email: 'mira@example.test', password: 'short'
    });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toMatch(/8 to 72/);
    expect(exists).not.toHaveBeenCalled();
  });

  test('requires a valid bearer token for private music endpoints', async () => {
    const response = await request(app).get('/api/tracks');
    expect(response.status).toBe(401);
    expect(response.body.error.message).toMatch(/Authentication required/);
  });

  test('scopes library search to the authenticated account', async () => {
    const lean = jest.fn().mockResolvedValue([]);
    const sort = jest.fn().mockReturnValue({ lean });
    const find = jest.spyOn(Track, 'find').mockReturnValue({ sort });
    const response = await request(app).get('/api/tracks?q=blue&sort=title')
      .set('Authorization', `Bearer ${tokenFor('alice')}`);

    expect(response.status).toBe(200);
    expect(find.mock.calls[0][0]).toMatchObject({ owner: 'alice' });
    expect(find.mock.calls[0][0].$or[0].title.test('Blue Monday')).toBe(true);
  });

  test('does not stream another account’s track', async () => {
    const findOne = jest.spyOn(Track, 'findOne').mockResolvedValue(null);
    const response = await request(app).get('/api/tracks/507f1f77bcf86cd799439011/stream')
      .set('Authorization', `Bearer ${tokenFor('alice')}`);

    expect(response.status).toBe(404);
    expect(findOne).toHaveBeenCalledWith({ _id: '507f1f77bcf86cd799439011', owner: 'alice' });
  });

  test('does not delete a playlist owned by another account', async () => {
    const remove = jest.spyOn(Playlist, 'findOneAndDelete').mockResolvedValue(null);
    const response = await request(app).delete('/api/playlists/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${tokenFor('alice')}`);

    expect(response.status).toBe(404);
    expect(remove).toHaveBeenCalledWith({ _id: '507f1f77bcf86cd799439011', owner: 'alice' });
  });
});
