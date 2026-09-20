// here we dont need to explcitly add to global
//  cause the file with .d.ts extentions automatically does it

namespace Express {
  interface Request {
    user?: {
      id: string;
    };
  }
}
