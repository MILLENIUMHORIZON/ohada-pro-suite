
-- Create triggers for stock_moves to process stock quantity updates
CREATE TRIGGER trg_stock_move_insert
  AFTER INSERT ON public.stock_moves
  FOR EACH ROW
  EXECUTE FUNCTION public.process_stock_move_insert();

CREATE TRIGGER trg_stock_move_validation
  AFTER UPDATE ON public.stock_moves
  FOR EACH ROW
  EXECUTE FUNCTION public.process_stock_move_validation();
