# Table de décision

```elixir
Mix.install([{:tablex, "~> 0.1.0"}])
```

## Simple exemple d'utilisation de tablex

Simple exemple dans livebook repris de ce post https://q-the-hacker.com/post/decision-tables-in-elixir-applications-part-1?utm_medium=email&utm_source=elixir-radar

```elixir
config = """
F user.level order.amount || discount
1 0,1        <50          || "10%"
2 0,1        >=50         || "20%"
3 >1         <30          || "15%"
4 >1         <50          || "20%"
5 >1         >=50         || "25%"
"""

user = %{level: 2}
order = %{amount: 10}
table = Tablex.new(config)
Tablex.decide(table, user: user, order: order)
```

<!-- livebook:{"output":true} -->

```
%{discount: "15%"}
```