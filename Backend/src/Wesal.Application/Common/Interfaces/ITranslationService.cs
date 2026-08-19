namespace Wesal.Application.Common.Interfaces;

public interface ITranslationService
{
    string Resolve(string key, string? language = null);
}