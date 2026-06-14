describe('AppModule', () => {
  it('should be defined', () => {
    const AppModule = import('./app.module');
    expect(AppModule).toBeDefined();
  });
});
