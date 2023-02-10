import { Cycler } from './cycler';

describe('manageDestructor', () => {
    it('should accept a destructor', () => {
        const c = new Cycler();

        c.manageDestructor(() => {});
    });
});

describe('dispose', () => {
   it('should dispose destructors', () => {
       const c = new Cycler();

       const mockCallback = jest.fn();

       c.manageDestructor(mockCallback);
       c.dispose();

       expect(mockCallback.mock.calls).toHaveLength(1);
   });
});
