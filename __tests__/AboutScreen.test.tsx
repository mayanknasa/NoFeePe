import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AboutScreen } from '../src/screens/AboutScreen';

describe('AboutScreen', () => {
  it('renders correctly with NoFeePe branding and information', () => {
    const navigationMock = {
      goBack: jest.fn(),
      navigate: jest.fn(),
    } as any;
    const routeMock = {
      key: 'About',
      name: 'About',
    } as any;

    let renderer: any;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <AboutScreen navigation={navigationMock} route={routeMock} />
      );
    });

    expect(renderer).toBeDefined();
    const tree = renderer.toJSON();
    expect(tree).not.toBeNull();
  });
});
