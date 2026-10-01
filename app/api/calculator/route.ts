import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { input } = await request.json();
    
    // Example specific logic: Multiply by 42
    const parsedInput = parseFloat(input);
    if (isNaN(parsedInput)) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    
    const result = parsedInput * 42; 

    // Return the calculated result
    return NextResponse.json({ result: `The calculated value is ${result}` });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to calculate' }, { status: 500 });
  }
}
