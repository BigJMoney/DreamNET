# Template for Writing Pseudocode

Use this template whenever writing pseudo code.

## High Level

### Object Entries
- Include an entry for each "high level" object (classes, methods, functions, etc.) and top level constants/config 
  values (primitive literals) that materially affect behavior.
- Use the same object name and signature (including paramter names/order) as in the source
- Do not include executable implementation inside the body. Instead, represent bodies as a structural outline: list 
  nested members (ex. fields/functions) as their own entries
- If a body contains no nested entries use "..."
- Classes should include inside of them the explicit definition of all member fields with a descriptive comment for 
  each.
- A constructor method is considered just another method, so should be included in the same manner (i.e. as a nested,
  object).
  - Constructor params and calls should be included in the JSDoc for the constructor, *not inside the class docstring*.
  - This means that a class's JSDoc should only contain its description.
- There should be no comments directly about code inside the body, all information should be in the JSDoc 
  description (see below).
- However, for structural and organizational purposes, section headers (e.g. Fields, Constructor, Methods) may be used 
  inside the block as labeled regions.

### JSDoc

Write A JSDoc string for each non-primitive high level object that includes its basic description in plain language:
- Always put JSDoc inside the fenced block "```"
- The name of the object should not also be in the JSDoc, since it is already present in the code below it. Skip 
  the name and go right to the description.
- The main description should be a conceptual summary, not a line by line translation from code logic to English logic.
- Individual logic details beyond what has been explicitly requested in this doc are not wanted. Overview (plus 
  requirements), not detail.
- Do not describe function bodies as execution checklists (e.g., "dequeues..., calls..., increments..."). Intead write 
  a policy statement describing a function's role, guarantees and state transitions.
  - Exception: A short 2-4 item phase list is allowed only if each item is a _conceptual phase_ (not a translation of 
    code lines)
- Do not write any empty sections (e.g. "state transitions: none") with the single exception being that "outputs: none" 
  is allowed.

Also include these items below:
- All parameters with descriptions, but use "param" instead of "@param" to avoid markdown lexer issues in comments
- For functions: list notable internal/external calls that define behavior and omit trivial built-ins (ex. Math, 
  String, array iteration and logging unless it's sematically critical)
  - This list must only include *semantically defining calls*
  - It must not be used to recreate execution order
  - Do not list more than 5 calls unless the function is primarily an orchestration boundary
  - The list of calls is not a substitute for descriptive documentation, it is in addition to it
- For *significant* conditional function() calls: use the format "calls x() when y" where y is a plain language
  description of the condition, as much as possible
  - Place them in a section underneath "calls:" called "conditional calls:"
  - Still no more than 5 *total* calls (calls + conditional calls) listed unless the function is primarily an 
    orchestration boundary
- For await function() calls: use the format "awaits a call to x()"
- If there are no internal calls for the object, do not include a list of calls

### Policy Statement Format (required for functions)

For methods/functions, the main description must be written in this order:
1. Role: One or more sentences: "This method is the boundary that..."
2. Guarantees / Invariants: 2-5 short "guarantees:" statements (not steps)
3. State transitions: If relevant, describe how key state fields move
4. Observable outputs: Events emitted / returns / externally visible effects

- Prefer explanatory verbs like enforces / guarantees / establishes / preserves / defines / bounds over logical 
  verbs does / then / after / next
- When mentioning multiple behaviors, *group by purpose* rather than execution order

## Single Nested Object Rule

### Single Object Printout Rule

When documenting a class, module or primary object:
- Emit exactly one pseudocode block for the object.
- All content returned from this task should be included inside a sigle fenced block "```". If any output is 
  returned outside of that, the output is considered incorrect and must be regenerated.
- All fields and methods (which includes constructor) must be nested inside that block.
- Do not emit separate pseudocode blocks for individual methods or sections.

The output should read as a single, vertically-scannable structure, not a collection of disconnected snippets. If 
multiple pseudocode blocks are generated for a single object at the top level, the output is considered incorrect 
and must be regenerated.

### Example Form

```
/***
 * JSDoc
 */
object ExampleObject
{
    // Fields
    fieldA
    fieldB

    // Constructor
    init(params)
    {
        ...
    }

    methodOne()
    {
        ...
    }

    methodTwo()
    {
        ...
    }
}
```

