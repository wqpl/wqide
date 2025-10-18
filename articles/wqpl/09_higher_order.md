# Higher-order bfns

A "higher-order" function is one that either accepts other functions as arguments or returns them.

wq provides several higher-order bfns to help you write clean, concise, and data-oriented code.

## `filter`

`filter[f;xs]` keeps only the items in your list for which the given function `f` returns `true`.

```wq
xs:1..=10
filter[{x%2=0};xs]
```

## `map`

`map[f;xs]` creates a new list by applying your function `f` to every item in your list `xs`.

```wq
xs:1..=10
map[{x*10};xs]
```

## `fold`

`fold[f;xs]` "folds" a list into a single value.

It starts with an initial value and processes the list item-by-item.

For each item, it uses your function to combine the current result with that item to create a new, updated result.

```wq
xs:(1;2;3;4;5)
fold[{[a;x]a+x};0;xs]
```

## `scan`

`scan[f;xs]` is like `fold`, but instead of returning only the final result, it returns a list of all intermediate values.

```wq
xs:(1;2;3;4;5)
scan[{[acc;x]acc+x};0;xs]
```

## Pipe `|`

Pipe syntax lets you write a chain of function applications from left to right. It passes the value on the left as the last argument to the function on the right.

```wq
iota 10 |sum |echo
```

The pipeline above is equivalent to:

```wq
echo sum iota 10
```

This is useful when several higher-order functions each consume the previous result, where in normal syntax nested parentheses would be necessary:

```wq
iota 10
|filter{x%2=0}
|map{x*x}
|sum
|echo
```

## Summary

- `filter[f;xs]` keeps elements matching a condition.
- `map[f;xs]` transforms every element.
- `fold[f;xs]` reduces elements to a single value.
- `scan[f;xs]` yields all intermediate reduction steps.
- `|` pipes a value through a chain of function calls, injecting it as the last argument.
